import { Events, Vector } from 'quark2d';
import { Render } from '../render/Render';

export interface QMouseEvent {
    mouse: Mouse;
    event: any;
}

export class Mouse {
    render: Render;
    events: Events = new Events();
    pressed: boolean = false;
    leftButtonPressed : boolean = false;
    rightButtonPressed: boolean = false;
    wheelButtonPressed: boolean = false;
    localPosition: Vector = new Vector();
    position: Vector = new Vector();
    localMovement: Vector = new Vector();
    movement: Vector = new Vector();
    scroll: Vector = new Vector();
    mousedownListener = (event: MouseEvent) => this.mouseDown(event);
    mouseupListener = (event: MouseEvent) => this.mouseUp(event);
    mousemoveListener = (event: MouseEvent) => this.mouseMove(event);
    wheelListener = (event: MouseEvent) => this.mouseWheel(event);
    touchstartListener = (event: TouchEvent) => this.touchStart(event);
    touchendListener = (event: TouchEvent) => this.touchEnd(event);
    touchmoveListener = (event: TouchEvent) => this.touchMove(event);

    constructor (render: Render) {

        this.render = render;

        this.render.canvas.addEventListener('mousedown', this.mousedownListener);
        this.render.canvas.addEventListener('mouseup', this.mouseupListener);
        this.render.canvas.addEventListener('mousemove', this.mousemoveListener);
        this.render.canvas.addEventListener('wheel', this.wheelListener);
        if (this.render.canvas.parentElement) {
            this.render.canvas.parentElement.addEventListener('touchstart', this.touchstartListener);
            this.render.canvas.parentElement.addEventListener('touchend', this.touchendListener);
            this.render.canvas.parentElement.addEventListener('touchmove', this.touchmoveListener);
        }
    }

    removeListeners () {
        this.render.canvas.removeEventListener('mousedown', this.mousedownListener);
        this.render.canvas.removeEventListener('mouseup', this.mouseupListener);
        this.render.canvas.removeEventListener('mousemove', this.mousemoveListener);
        this.render.canvas.removeEventListener('wheel', this.wheelListener);
    }

    mouseDown (event: MouseEvent) {
        this.pressed = true;

        if (event.button === 0) {
            this.leftButtonPressed = true;
        } else if (event.button === 1) {
            this.wheelButtonPressed = true;
        } else if (event.button === 2) {
            this.rightButtonPressed = true;
        }

        this.localPosition.set(event.offsetX, event.offsetY);
        this.updatePosition();
        
        this.events.trigger('mouse-down', [{mouse: this, event}]);

    }
    
    mouseUp (event: MouseEvent) {
        if (event.buttons <= 0) {
            this.pressed = false;
        }

        if (event.button === 0) {
            this.leftButtonPressed = false;
        } else if (event.button === 1) {
            this.wheelButtonPressed = false;
        } else if (event.button === 2) {
            this.rightButtonPressed = false;
        }

        this.localPosition.set(event.offsetX, event.offsetY);
        this.updatePosition();

        this.events.trigger('mouse-up', [{mouse: this, event}]);
    }

    mouseMove (event: MouseEvent) {
        this.localPosition.set(event.offsetX, event.offsetY);
        this.updatePosition();

        this.localMovement.set(event.movementX, event.movementY);
        this.updateMovement();

        this.events.trigger('mouse-move', [{mouse: this, event}]);
    }

    mouseWheel (event: MouseEvent) {
        this.events.trigger('wheel', [{mouse: this, event}]);
        console.log(event);
    }

    touchStart (event: TouchEvent) {
        if (this.render.canvas.parentElement && event.target && event.target === this.render.canvas) {
            this.pressed = true;

            this.leftButtonPressed = true;
            if (event.touches.length > 1) {
                this.rightButtonPressed = true;
            }

            // @ts-ignore
            const {x, y, width, height} = event.target.getBoundingClientRect();
            // @ts-ignore
            const offsetX = (event.touches[0].clientX - x) / width * event.target.offsetWidth;
            // @ts-ignore
            const offsetY = (event.touches[0].clientY - y) / height * event.target.offsetHeight;

            this.localPosition.set(offsetX, offsetY);
            this.updatePosition();

            this.events.trigger('mouse-down', [{mouse: this, event}]);
        }
    }

    touchEnd (event: TouchEvent) {
        if (this.render.canvas.parentElement && event.target && event.target === this.render.canvas) {
            this.pressed = false;
            this.leftButtonPressed = false;
            this.rightButtonPressed = false;

            // @ts-ignore
            const {x, y, width, height} = event.target.getBoundingClientRect();
            // @ts-ignore
            const offsetX = (event.changedTouches[0].clientX - x) / width * event.target.offsetWidth;
            // @ts-ignore
            const offsetY = (event.changedTouches[0].clientY - y) / height * event.target.offsetHeight;

            this.localPosition.set(offsetX, offsetY);
            this.updatePosition();

            this.events.trigger('mouse-up', [{mouse: this, event}]);
        }
    }

    touchMove (event: TouchEvent) {
        if (this.render.canvas.parentElement && event.target && event.target === this.render.canvas) {
            // @ts-ignore
            const {x, y, width, height} = event.target.getBoundingClientRect();
            // @ts-ignore
            const offsetX = (event.touches[0].clientX - x) / width * event.target.offsetWidth;
            // @ts-ignore
            const offsetY = (event.touches[0].clientY - y) / height * event.target.offsetHeight;

            this.localMovement.x = offsetX - this.localPosition.x;
            this.localMovement.y = offsetY - this.localPosition.y;
            this.updateMovement();

            this.localPosition.set(offsetX, offsetY);
            this.updatePosition();

            this.events.trigger('mouse-move', [{mouse: this, event}]);
        }
    }

    updatePosition () {
        this.position.set(
            (this.localPosition.x - this.render.canvas.width / 2) / this.render.scale - this.render.translate.x,
            (this.localPosition.y - this.render.canvas.height / 2) / this.render.scale - this.render.translate.y
        );
    }

    updateMovement () {
        this.movement.set(
            this.localMovement.x / this.render.scale,
            this.localMovement.y / this.render.scale,
        );
    }

}