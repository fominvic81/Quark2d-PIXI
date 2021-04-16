# Quark2d-PIXI

[Install](#install) - [Example](#Example)

## Install

#### Npm
    npm install quark2d-pixi
#### Yarn
    yarn add quark2d-pixi

## Example

Use the left mouse button to move the bodies.

Right mouse button to move the camera.

Mouse wheel to zoom.

    import {
        Engine,
        BodyType,
        SleepingType,
        Vector,
        Factory,
        MouseConstraint,
        Runner,
    } from 'quark2d';
    import { Render as PixiRender } from 'quark2d-pixi';

    // Create new engine
    const engine = new Engine();

    // Disable sleeping
    engine.sleeping.type = SleepingType.NO_SLEEPING;

    // Add ground
    const ground = Factory.Body.rectangle(new Vector(0, 8), 0, 100, 1, {type: BodyType.static});
    engine.world.add(ground);

    // Add boxes
    for (let i = 0; i < 10; ++i) {
        for (let j = 0; j < 6; ++j) {
            engine.world.add(Factory.Body.rectangle(new Vector(i -4.5, -j), 0, 0.7, 0.7, {}, {radius: 0.1}));
        }
    }

    // Add circle
    engine.world.add(Factory.Body.circle(new Vector(0, 7), 0.5));

    // Create new render
    const render = new PixiRender(engine, {
        element: document.body,
        width: window.innerWidth,
        height: window.innerHeight,

        showCollisions: true,
    });

    // Add mouse control
    const mouseConstraint = new MouseConstraint(engine, render.mouse);

    // Create runner
    const runner = new Runner();

    // Run runner
    runner.events.on('render', (timestamp) => {
        render.update();
    });
    runner.events.on('update', (timestamp) => {
        engine.update(timestamp);
    });
    runner.run();
    runner.runRender();