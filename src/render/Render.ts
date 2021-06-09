import * as PIXI from 'pixi.js';
import {
    AABB,
    AABBTree,
    Body,
    Circle,
    Constraint,
    ConstraintType,
    Convex,
    Edge,
    Engine,
    GridBroadphase,
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
    shapeOutline?: {(shape: Shape): number | undefined};
    constraint?: {(constraint: Constraint): number};
}

interface RenderOptioins {
    element: HTMLElement;
    width?: number;
    height?: number;
    backgroundColor?: number;
    translate?: Vector;
    scale?: number;
    colors?: colors;
    showSleeping?: boolean;
    showCollisions?: boolean;
    showConstraints?: boolean;
    showSensors?: boolean;
    showAABBs?: boolean;
    showPositions?: boolean;
    showStatus?: boolean;
    showBroadphase?: boolean;
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
    stage: PIXI.Container = new PIXI.Container();
    sprites: Map<number, PIXI.Graphics> = new Map();
    engine: Engine;
    textContainer: PIXI.Container = new PIXI.Container();
    statusText: PIXI.Text = new PIXI.Text('', {fontSize: 20, fill: PIXI.utils.rgb2hex([0.6, 0.6, 0.6])});
    statusUpdateTimer: number = 0;
    graphics: PIXI.Graphics = new PIXI.Graphics();
    userGraphics: PIXI.Graphics = new PIXI.Graphics();
    canvas: HTMLCanvasElement;
    mouse: Mouse;
    scale: number;
    realScale: number;
    translate: Vector;
    options: {
        showSleeping: boolean;
        showCollisions: boolean;
        showConstraints: boolean;
        showSensors: boolean;
        showAABBs: boolean;
        showPositions: boolean;
        showStatus: boolean;
        showBroadphase: boolean;
    };
    colors: {
        shape: {(shape: Shape): number};
        shapeOutline: {(shape: Shape): number | undefined};
        constraint: {(constraint: Constraint): number};
    };
    aabb: AABB = new AABB();
    
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
            backgroundColor: options.backgroundColor ?? PIXI.utils.rgb2hex([0.2, 0.2, 0.2]),
        });
        this.textContainer.zIndex = 4;
        this.graphics.zIndex = 3;
        this.userGraphics.zIndex = 5;
        this.stage.addChild(this.textContainer);
        this.stage.addChild(this.graphics);
        this.stage.addChild(this.userGraphics);
        
        this.statusText.resolution = 20;
        this.textContainer.addChild(this.statusText);

        this.scale = options.scale ?? 30;
        this.realScale = this.scale;
        this.setScale(this.scale);
        this.translate = options.translate === undefined ? new Vector(0, 0) : options.translate.clone();
        this.options = {
            showSleeping: options.showSleeping ?? true,
            showCollisions: options.showCollisions ?? false,
            showConstraints: options.showConstraints ?? false,
            showSensors: options.showSensors ?? true,
            showAABBs: options.showAABBs ?? false,
            showPositions: options.showPositions ?? false,
            showStatus: options.showStatus ?? false,
            showBroadphase: options.showBroadphase ?? false,
        };
        let constrColor = PIXI.utils.rgb2hex([0.8, 0.8, 0.8]);
        this.colors = {
            shape: options.colors ? (options.colors.shape ?? (() => Render.randomColor())) : (() => Render.randomColor()),
            shapeOutline: options.colors ? (options.colors.shapeOutline ?? (() => PIXI.utils.rgb2hex([0.8, 0.8, 0.8]))) : (() => PIXI.utils.rgb2hex([0.8, 0.8, 0.8])),
            constraint: options.colors ? (options.colors.constraint ?? (() => constrColor)) : () => constrColor,
        }

        engine.world.on('remove-body', (event) => {
            this.removeBody(event.body);
        });
        engine.world.on('remove-constraint', (event) => {
            this.removeConstraint(event.constraint);
        });

        this.mouse = new Mouse(this);

        this.mouse.on('mouse-move', (event) => {this.mouseMove(event)});
        this.mouse.on('wheel', (event) => {this.mouseWheel(event)});
    }

    setShowSleeping (value: boolean) {
        this.options.showSleeping = value;
        if (!value) {
            for (const body of this.engine.world.bodies.values()) {
                for (const shape of body.shapes) {
                    const sprite = this.sprites.get(shape.id);
                    if (!sprite) continue;
                    sprite.alpha = 1;
                }
            }
        }
    }

    setShowConstraints (value: boolean) {
        this.options.showConstraints = value;
        if (!value) {
            for (const constraint of this.engine.world.constraints.values()) {
                const sprite = this.sprites.get(constraint.id);
                if (!sprite) continue;
                sprite.clear();
            }
        }
    }

    setShowSensors (value: boolean) {
        this.options.showSensors = value;
        if (value) {
            for (const body of this.engine.world.bodies.values()) {
                for (const shape of body.shapes) {
                    const sprite = this.sprites.get(shape.id);
                    if (!sprite) continue;
                    sprite.visible = true;
                }
            }
        }
    }

    setShowStatus (value: boolean) {
        this.options.showStatus = value;
        if (!value) {
            this.statusText.text = '';
        }
    }

    /**
     * Renders the world.
     */
    update (delta: number) {
        this.statusUpdateTimer += delta;
        this.graphics.clear();

        this.textContainer.pivot.set(this.renderer.width * 0.5 + this.translate.x * this.realScale, this.renderer.height * 0.5 + this.translate.y * this.realScale);
        this.textContainer.scale.set(1/this.realScale, 1/this.realScale);
        this.stage.scale.set(this.realScale, this.realScale);
        this.stage.pivot.set(-this.renderer.width / (this.realScale) * 0.5 - this.translate.x, -this.renderer.height / (this.realScale) * 0.5 - this.translate.y);

        this.aabb.minX = (-this.canvas.width / 2) / this.realScale - this.translate.x;
        this.aabb.maxX = (this.canvas.width / 2) / this.realScale - this.translate.x;
        this.aabb.minY = (-this.canvas.height / 2) / this.realScale - this.translate.y;
        this.aabb.maxY = (this.canvas.height / 2) / this.realScale - this.translate.y;

        this.shapes();
        if (this.options.showConstraints) this.constraints();
        if (this.options.showCollisions) this.collisions();
        if (this.options.showAABBs) this.AABBs();
        if (this.options.showPositions) this.positions();
        if (this.options.showStatus) this.status();
        if (this.options.showBroadphase) this.broadphase();

        this.renderer.render(this.stage);
    }

    /**
     * Renders the shapes.
     */
    private shapes () {
        for (const body of this.engine.world.bodies.values()) {
            for (const shape of body.shapes) {
                let sprite = this.sprites.get(shape.id);
                if (!sprite) {
                    sprite = this.createShapeSprite(shape);
                    this.stage.addChild(sprite);
                    this.sprites.set(shape.id, sprite);
                    this.stage.sortChildren();
                }

                if (this.options.showSleeping) {
                    switch (shape.body!.sleepState) {
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

                sprite.position.set(shape.body!.center.x, shape.body!.center.y);
                sprite.rotation = shape.body!.angle;
            }
        }
    }

    /**
     * Renders the constraints
     */
    private constraints () {
        for (const constraint of this.engine.world.constraints.values()) {
            let sprite = this.sprites.get(constraint.id);
            if (!sprite) {
                sprite = new PIXI.Graphics();
                sprite.zIndex = 2;
                this.stage.addChild(sprite);
                this.sprites.set(constraint.id, sprite);
                this.stage.sortChildren();
            }

            const pointA = constraint.getWorldPointA();
            const pointB = constraint.getWorldPointB();

            sprite.clear();

            sprite.beginFill(this.colors.constraint(constraint));
            sprite.drawCircle(pointA.x, pointA.y, 0.1);
            sprite.drawCircle(pointB.x, pointB.y, 0.1);
            sprite.endFill();

            switch (constraint.type) {
                case ConstraintType.DISTANCE_CONSTRAINT:
                    sprite.lineStyle(0.08, this.colors.constraint(constraint));
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
            if (pair.isSensor) continue;
            for (let i = 0; i < pair.contactsCount; ++i) {
                const contact = pair.contacts[i];
                this.graphics.drawRect(contact.vertex.x - 0.05, contact.vertex.y - 0.05, 0.1, 0.1);
            }
        }

        for (const pair of this.engine.manager.activePairs) {
            if (pair.isSensor) continue;
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
        for (const body of this.engine.world.bodies.values()) {
            for (const shape of body.shapes) {
                this.graphics.moveTo(shape.aabb.minX, shape.aabb.minY);
                this.graphics.lineTo(shape.aabb.maxX, shape.aabb.minY);
                this.graphics.lineTo(shape.aabb.maxX, shape.aabb.maxY);
                this.graphics.lineTo(shape.aabb.minX, shape.aabb.maxY);
                this.graphics.lineTo(shape.aabb.minX, shape.aabb.minY);
            }
        }
    }

    positions () {
        this.graphics.beginFill(PIXI.utils.rgb2hex([0.8, 0.8, 0.8]));
        this.graphics.line.visible = false;
        for (const body of this.engine.world.bodies.values()) {
            this.graphics.drawRect(body.position.x - 0.05, body.position.y - 0.05, 0.1, 0.1);
        }
        this.graphics.endFill();
        this.graphics.beginFill(PIXI.utils.rgb2hex([0.5, 0.8, 0.1]));
        for (const body of this.engine.world.bodies.values()) {
            this.graphics.drawRect(body.center.x - 0.05, body.center.y - 0.05, 0.1, 0.1);
        }
        this.graphics.endFill();
        this.graphics.beginFill(PIXI.utils.rgb2hex([0.8, 0.2, 0.2]));
        for (const body of this.engine.world.bodies.values()) {
            for (const shape of body.shapes) {
                this.graphics.drawRect(shape.position.x - 0.04, shape.position.y - 0.04, 0.08, 0.08);
            }
        }
        this.graphics.endFill();
    }

    status () {
        if (this.statusUpdateTimer > 0.1) {
            this.statusUpdateTimer = 0;
            let text = '';

            text += `tps: ${this.engine.timestamp?.tps?.toFixed(1)}\n`
            text += `bodies: ${this.engine.world.bodies.size}\n`;
            text += `constraints: ${this.engine.world.constraints.size}\n`;
            text += `broadphase pairs: ${this.engine.manager.broadphase.getPairsCount()}\n`;
            text += `midphase pairs: ${this.engine.manager.midphase.getPairsCount()}\n`;
            text += `narrowphase pairs: ${this.engine.manager.getPairsCount()}\n`;

            this.statusText.text = text;
        }
    }

    broadphase () {
        const broadphase = this.engine.manager.broadphase;
        if (broadphase instanceof GridBroadphase) {
            this.graphics.lineStyle(0.08, PIXI.utils.rgb2hex([0.2, 0.3, 0.6]));

            const grid = broadphase.grid;
            const position = Vector.temp[0];

            const minX = Math.round(this.aabb.minX / broadphase.gridSize - 0.5);
            const minY = Math.round(this.aabb.minY / broadphase.gridSize - 0.5);
            const maxX = Math.round(this.aabb.maxX / broadphase.gridSize + 0.5);
            const maxY = Math.round(this.aabb.maxY / broadphase.gridSize + 0.5);

            if (maxX - minX > 50 || maxY - minY > 50) {
                this.aabb.minX -= broadphase.gridSize;
                this.aabb.minY -= broadphase.gridSize;
                for (const position of grid.keys()) {
                    position.scale(broadphase.gridSize);
                    if (!this.aabb.contains(position)) continue;
                    this.graphics.drawRect(position.x, position.y, broadphase.gridSize, broadphase.gridSize);
                }
                this.aabb.minX += broadphase.gridSize;
                this.aabb.minY += broadphase.gridSize;
            } else {
                for (let i = minX; i < maxX; ++i) {
                    for (let j = minY; j < maxY; ++j) {
                        position.set(i, j);
                        if (grid.get(position)) {
                            position.scale(broadphase.gridSize);
                            this.graphics.drawRect(position.x, position.y, broadphase.gridSize, broadphase.gridSize);
                        }
                    }
                }
            }
        } else if (broadphase instanceof AABBTree) {

            const stack = [broadphase.root];

            while (true) {
                
                const node = stack.pop();
                if (!node) break;

                if (!node.isLeaf) {
                    stack.push(node.childA!);
                    stack.push(node.childB!);
                }

                const aabb = node.aabb;

                this.graphics.lineStyle(0.05, PIXI.utils.rgb2hex([0.2, 0.3, 0.6]));
                this.graphics.moveTo(aabb.minX, aabb.minY);
                this.graphics.lineTo(aabb.maxX, aabb.minY);
                this.graphics.lineTo(aabb.maxX, aabb.maxY);
                this.graphics.lineTo(aabb.minX, aabb.maxY);
                this.graphics.lineTo(aabb.minX, aabb.minY);

                if (node.parent) {
                    const start = node.parent.aabb.center(Vector.temp[0]);
                    const end = node.aabb.center(Vector.temp[1]);

                    this.graphics.lineStyle(0.08, PIXI.utils.rgb2hex([0.6, 0.6, 0.6]));
                    this.graphics.moveTo(start.x, start.y);
                    this.graphics.lineTo(end.x, end.y);
                }
            }
        }
    }

    private removeBody (body: Body) {
        for (const shape of body.shapes) {
            this.removeShape(shape);
        }
    }

    private removeShape (shape: Shape) {
        const sprite = this.sprites.get(shape.id);
        if (sprite) this.stage.removeChild(sprite);
        this.sprites.delete(shape.id);
    }

    private removeConstraint (constraint: Constraint) {
        const sprite = this.sprites.get(constraint.id);
        if (sprite) this.stage.removeChild(sprite);
        this.sprites.delete(constraint.id);
    }

    private createShapeSprite (shape: Shape) {
        switch (shape.type) {
            case ShapeType.CIRCLE:
                return this.createCircleSprite(<Circle>shape);
            case ShapeType.CONVEX:
                return this.createConvexSprite(<Convex>shape);
            case ShapeType.EDGE:
                return this.createEdgeSprite(<Edge>shape);
            default:
                throw new Error();
        }
    }

    private createCircleSprite (circle: Circle): PIXI.Graphics {
        const sprite = new PIXI.Graphics();

        const outline = this.colors.shapeOutline(circle);
        if (outline) sprite.lineStyle(outline ? 0.03 : 0, outline);
        sprite.beginFill(this.colors.shape(circle));
        const p = [];

        const count = 100 * circle.radius;
        for (let i = 0; i < count; ++i) {
            p.push(
                Math.sin(i/count * Math.PI * 2) * (circle.radius) - circle.body!.center.x + circle.position.x,
                Math.cos(i/count * Math.PI * 2) * (circle.radius) - circle.body!.center.y + circle.position.y,
            );
        }
        sprite.drawPolygon(p);
        sprite.endFill();

        sprite.zIndex = 1;

        return sprite;
    }

    private createConvexSprite (convex: Convex): PIXI.Graphics {
        const sprite = new PIXI.Graphics();

        const outline = this.colors.shapeOutline(convex);
        if (outline) sprite.lineStyle(outline ? 0.03 : 0, outline);

        let vertices;

        const verts = Vertices.create(convex.vertices);
        Vertices.translate(verts, convex.body!.center.neg(Vector.temp[0]));
        Vertices.rotate(verts, -convex.body!.angle);
        if (convex.radius) {
            const normals = Vertices.create(convex.normals);
            Vertices.rotate(normals, -convex.body!.angle);
            vertices = this.roundedPath(verts, normals, convex.radius, Math.max(1000 / verts.length * convex.radius, 1));
        } else {
            vertices = verts;
        }

        const path = [];
        for (const vertex of vertices) {
            path.push(vertex.x, vertex.y);
        }
        sprite.beginFill(this.colors.shape(convex));
        sprite.drawPolygon(path);
        sprite.endFill();

        sprite.zIndex = 1;

        return sprite;
    }

    private createEdgeSprite (edge: Edge): PIXI.Graphics {
        const sprite = new PIXI.Graphics();

        const outline = this.colors.shapeOutline(edge);
        if (outline) sprite.lineStyle(outline ? 0.03 : 0, outline);

        const verts = Vertices.create([edge.start, edge.end]);
        Vertices.translate(verts, edge.body!.center.neg(Vector.temp[0]));
        Vertices.rotate(verts, -edge.body!.angle);
        const normals = Vertices.create([edge.normal.neg(new Vector()), edge.normal]);
        Vertices.rotate(normals, -edge.body!.angle);
        const vertices = this.roundedPath(verts, normals, edge.radius, 100 * edge.radius);

        const path = [];
        for (const vertex of vertices) {
            path.push(vertex.x, vertex.y);
        }
        sprite.beginFill(this.colors.shape(edge));
        sprite.drawPolygon(path);
        sprite.endFill();

        sprite.zIndex = 1;

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
        this.setScale(this.scale - event.event.deltaY * this.scale / 1000);
    }

    setScale (scale: number) {
        this.scale = scale;
        this.realScale = this.scale * Math.min(this.canvas.width, this.canvas.height) / 1500;
    }
}