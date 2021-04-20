import * as PIXI from 'pixi.js';
import {
    Body,
    Circle,
    Constraint,
    ConstraintType,
    Convex,
    Edge,
    Engine,
    Shape,
    ShapeType,
    SleepingState,
    Vector,
    Vertex,
    Vertices
} from 'quark2d';
import { Mouse, QMouseEvent } from '../mouse/Mouse';

interface colors {
    shape?: {(shape: Shape): number};
    constraint?: number;
}

interface RenderOptioins {
    element: HTMLElement;
    width?: number;
    height?: number;
    translate?: Vector;
    scale?: number;
    colors?: colors;
    showSleeping?: boolean;
    showCollisions?: boolean;
    showConstraints?: boolean;
    showSensors?: boolean;
    showAABBs?: boolean;
    showPositions?: boolean;
}

/**
 * @example:
 * 
 *     const render = new PixiRender(engine, {
 *         element: document.body,
 *         width: 800,
 *         height: 600,
 * 
 *         showCollisions: true,
 *     });
 */

export class Render {
    renderer: PIXI.Renderer;
    stage: PIXI.Container;
    shapes: Set<Shape> = new Set();
    constraints: Set<Constraint> = new Set();
    sprites: Map<number, PIXI.Graphics> = new Map();
    engine: Engine;
    graphics: PIXI.Graphics = new PIXI.Graphics();
    userGraphics: PIXI.Graphics = new PIXI.Graphics();
    canvas: HTMLCanvasElement;
    mouse: Mouse;
    scale: number;
    translate: Vector;
    options: {
        showSleeping: boolean;
        showCollisions: boolean;
        showConstraints: boolean;
        showSensors: boolean;
        showAABBs: boolean;
        showPositions: boolean;
    };
    colors: {
        shape: {(shape: Shape): number};
        constraint: number;
    };
    
    constructor (engine: Engine, options: RenderOptioins = {element: document.body}) {
        this.engine = engine;

        const width: number = options.width ?? 800;
        const height: number = options.height ?? 600;

        this.canvas = this.createCanvas(width, height);
        options.element.appendChild(this.canvas);

        this.renderer = new PIXI.Renderer({
            width,
            height,
            view: this.canvas,
            antialias: true,
            backgroundColor: PIXI.utils.rgb2hex([0.2, 0.2, 0.2]),
        });
        this.stage = new PIXI.Container();
        this.graphics.zIndex = 1;
        this.userGraphics.zIndex = 2;
        this.stage.addChild(this.graphics);
     
        this.scale = options.scale ?? 30;
        this.translate = options.translate === undefined ? new Vector(0, 0) : options.translate.clone();
        this.options = {
            showSleeping: options.showSleeping ?? true,
            showCollisions: options.showCollisions ?? false,
            showConstraints: options.showConstraints ?? false,
            showSensors: options.showSensors ?? true,
            showAABBs: options.showAABBs ?? false,
            showPositions: options.showPositions ?? false,
        };
        this.colors = {
            shape: options.colors ? (options.colors.shape ?? ((shape: Shape) => Render.randomColor())) : ((shape: Shape) => Render.randomColor()),
            constraint: options.colors ? (options.colors.constraint ?? PIXI.utils.rgb2hex([0.8, 0.8, 0.8])) : PIXI.utils.rgb2hex([0.8, 0.8, 0.8]),
        }

        for (const body of engine.world.bodies.values()) {
            this.addBody(body);
        }
        for (const constraint of engine.world.constraints.values()) {
            this.addConstraint(constraint);
        }

        engine.world.events.on('add-body', (event) => {
            this.addBody(event.body);
        });
        engine.world.events.on('add-constraint', (event) => {
            this.addConstraint(event.constraint);
        });

        this.mouse = new Mouse(this);

        this.mouse.events.on('mouse-move', (event) => {this.mouseMove(event)});
        this.mouse.events.on('wheel', (event) => {this.mouseWheel(event)});
    }

    setShowSleeping (value: boolean) {
        this.options.showSleeping = value;
        if (!value) {
            for (const shape of this.shapes) {
                const sprite = this.sprites.get(shape.id);
                if (!sprite) continue;
                sprite.alpha = 1;
            }
        }
    }

    setShowConstraints (value: boolean) {
        this.options.showConstraints = value;
        if (!value) {
            for (const constraint of this.constraints) {
                const sprite = this.sprites.get(constraint.id);
                if (!sprite) continue;
                sprite.clear();
            }
        }
    }

    setShowSensors (value: boolean) {
        this.options.showSensors = value;
        if (value) {
            for (const shape of this.shapes) {
                const sprite = this.sprites.get(shape.id);
                if (!sprite) continue;
                sprite.visible = true;
            }
        }
    }

    /**
     * Renders the world.
     */
    update () {

        this.stage.scale.set(this.scale, this.scale);
        this.stage.pivot.set(-this.renderer.width / (this.scale) * 0.5 - this.translate.x, -this.renderer.height / (this.scale) * 0.5 - this.translate.y);

        this.graphics.clear();

        this.shapes_();

        if (this.options.showConstraints) this.constraints_();
        if (this.options.showCollisions) this.collisions();
        if (this.options.showAABBs) this.AABBs();
        if (this.options.showPositions) this.positions();

        this.renderer.render(this.stage);
    }

    /**
     * Renders the shapes.
     */
    private shapes_ () {
        for (const shape of this.shapes) {
            const sprite = this.sprites.get(shape.id);
            if (!sprite) continue;

            if (this.options.showSleeping) {
                switch ((<Body>shape.body).sleepState) {
                    case SleepingState.AWAKE:
                        sprite.alpha = 1;
                        break;
                    case SleepingState.SLEEPING:
                        sprite.alpha = 0.5;
                        break;
                }
            }
            if (shape.isSensor) {
                if (this.options.showSensors) {
                    sprite.alpha = 0.3;
                    sprite.visible = true;
                } else {
                    sprite.visible = false;
                }
            }

            sprite.position.set(shape.position.x, shape.position.y);
            sprite.rotation = (<Body>shape.body).angle;
        }
    }

    /**
     * Renders the constraints
     */
    private constraints_ () {
        for (const constraint of this.constraints) {
            const sprite = this.sprites.get(constraint.id);
            if (!sprite) continue;

            const pointA = constraint.getWorldPointA();
            const pointB = constraint.getWorldPointB();

            sprite.clear();
            
            switch (constraint.type) {
                case ConstraintType.DISTANCE_CONSTRAINT:
                    sprite.lineStyle(0.08, this.colors.constraint);
                    sprite.moveTo(pointA.x, pointA.y);
                    sprite.lineTo(pointB.x, pointB.y);
                    break;
            }
        }
    }

    /**
     * Renders contacts and normals
     */
    private collisions () {

        this.graphics.beginFill(PIXI.utils.rgb2hex([1, 0, 0]));

        // TODO: use visible aabb
        for (const pair of this.engine.manager.activePairs) {
            for (let i = 0; i < pair.contactsCount; ++i) {
                const contact = pair.contacts[i];
                this.graphics.drawRect(contact.vertex.x - 0.05, contact.vertex.y - 0.05, 0.1, 0.1);
            }
        }

        for (const pair of this.engine.manager.activePairs) {
            for (let i = 0; i < pair.contactsCount; ++i) {
                const contact = pair.contacts[i];
                this.graphics.lineStyle(0.04, PIXI.utils.rgb2hex([1, 1, 0]));

                this.graphics.moveTo(contact.vertex.x, contact.vertex.y);
                this.graphics.lineTo(contact.vertex.x + contact.pair.normal.x * 0.2, contact.vertex.y + contact.pair.normal.y * 0.2);
            }
        }

        this.graphics.endFill();
    }

    AABBs () {
        this.graphics.lineStyle(0.02, PIXI.utils.rgb2hex([1, 1, 1]));
        for (const shape of this.shapes) {
            this.graphics.moveTo(shape.aabb.min.x, shape.aabb.min.y);
            this.graphics.lineTo(shape.aabb.max.x, shape.aabb.min.y);
            this.graphics.lineTo(shape.aabb.max.x, shape.aabb.max.y);
            this.graphics.lineTo(shape.aabb.min.x, shape.aabb.max.y);
            this.graphics.lineTo(shape.aabb.min.x, shape.aabb.min.y);
        }
    }

    positions () {
        this.graphics.beginFill(PIXI.utils.rgb2hex([0.5, 0.8, 0.1]));
        this.graphics.line.visible = false;
        for (const body of this.engine.world.bodies.values()) {
            this.graphics.drawRect(body.position.x - 0.05, body.position.y - 0.05, 0.1, 0.1);
        }
        this.graphics.beginFill(PIXI.utils.rgb2hex([0.8, 0.2, 0.2]));
        for (const shape of this.shapes) {
            this.graphics.drawRect(shape.position.x - 0.04, shape.position.y - 0.04, 0.08, 0.08);
        }
    }

    addBody (body: Body) {
        for (const shape of body.shapes) {
            this.addShape(shape);
        }
        body.events.on('add-shape', (event) => {
            this.addShape(event.shape);
        });
    }

    private addShape (shape: Shape) {
        this.shapes.add(shape);

        const sprite = this.createShapeSprite(shape, this.colors.shape(shape));
        this.stage.addChild(sprite);
        this.sprites.set(shape.id, sprite);
        this.stage.sortChildren();
    }

    addConstraint (constraint: Constraint) {
        this.constraints.add(constraint);

        const sprite = new PIXI.Graphics();
        this.stage.addChild(sprite);
        this.sprites.set(constraint.id, sprite);
        this.stage.sortChildren();
    }

    private createShapeSprite (shape: Shape, color: number) {
        switch (shape.type) {
            case ShapeType.CIRCLE:
                return this.createCircleSprite(<Circle>shape, color);
            case ShapeType.CONVEX:
                return this.createConvexSprite(<Convex>shape, color);
            case ShapeType.EDGE:
                return this.createEdgeSprite(<Edge>shape, color);
            default:
                throw new Error();
        }
    }

    private createCircleSprite (circle: Circle, color: number): PIXI.Graphics {
        const sprite = new PIXI.Graphics();

        sprite.beginFill(color);
        const p = [];

        const count = 50;
        for (let i = 0; i < count; ++i) {
            p.push(
                Math.sin(i/count * Math.PI * 2) * (circle.radius),
                Math.cos(i/count * Math.PI * 2) * (circle.radius)
            );
        }
        sprite.drawPolygon(p);

        sprite.endFill();

        return sprite;
    }

    private createConvexSprite (convex: Convex, color: number): PIXI.Graphics {
        const sprite = new PIXI.Graphics();

        const verts = Vertices.create(convex.vertices);
        Vertices.translate(verts, convex.position.neg(Vector.temp[0]));
        Vertices.rotate(verts, -(<Body>convex.body).angle);
        const normals = Vertices.create(convex.normals);
        Vertices.rotate(normals, -(<Body>convex.body).angle);
        const vertices = this.roundedPath(verts, normals, convex.radius, Math.max(100 / verts.length, 1));

        const path = [];
        for (const vertex of vertices) {
            path.push(vertex.x, vertex.y);
        }
        sprite.beginFill(color);
        sprite.drawPolygon(path);
        sprite.endFill();

        return sprite;
    }

    private createEdgeSprite (edge: Edge, color: number): PIXI.Graphics {
        const sprite = new PIXI.Graphics();

        const verts = Vertices.create([edge.start, edge.end]);
        Vertices.translate(verts, edge.position.neg(Vector.temp[0]));
        Vertices.rotate(verts, -(<Body>edge.body).angle);
        const normals = Vertices.create([edge.ngNormal, edge.normal]);
        Vertices.rotate(normals, -(<Body>edge.body).angle);
        const vertices = this.roundedPath(verts, normals, edge.radius, 50);

        const path = [];
        for (const vertex of vertices) {
            path.push(vertex.x, vertex.y);
        }
        sprite.beginFill(color);
        sprite.drawPolygon(path);
        sprite.endFill();

        return sprite;
    }

    private roundedPath (vertices: Vertex[], normals: Vector[], radius: number, quality: number) {

        const newVertices = [];
        
        for (const vertex of vertices) {
            const normal1 = normals[(normals.length + vertex.index - 1) % normals.length];
            const normal2 = normals[vertex.index];

            const cos = Vector.dot(normal1, normal2);
            const sin = Vector.cross(normal1, normal2);

            const offset = normal1.scale(radius, Vector.temp[0]);
            newVertices.push(Vector.add(vertex, offset, new Vector()));

            const angle = Math.abs(Math.atan2(sin, cos));

            const step = angle / quality;
            const sSin = Math.sin(step);
            const sCos = Math.cos(step);
            
            for (let i = 0; i < quality; ++i) {
                const x = offset.x;
                offset.x = x * sCos - offset.y * sSin;
                offset.y = x * sSin + offset.y * sCos;
                const newVertex = offset.clone().add(vertex);

                newVertices.push(newVertex);
            }
        }
        return newVertices;
    }

    /**
     * Returns random color.
     * @returns Random color
     */
    static randomColor (): number {
        return PIXI.utils.rgb2hex([Math.random(), Math.random(), Math.random()]);
    }

    private createCanvas (width: number, height: number) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.oncontextmenu = () => false;
        return canvas;
    }

    mouseMove (event: QMouseEvent) {
        if (this.mouse.rightButtonPressed) {
            this.translate.add(event.mouse.movement);
        }
    }

    mouseWheel (event: QMouseEvent) {
        this.scale -= event.event.deltaY * this.scale / 2000;
        this.scale -= event.event.deltaY * this.scale / 2000;
    }
}