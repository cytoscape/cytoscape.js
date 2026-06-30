// Compile-only test for the public Animation surface.
// `cy.animation()` / `eles.animation()` return an `Animation` (exported), with
// the documented lifecycle/getter/setter methods and aliases. This complements
// the docmaker `ani.*` member audit with real consumer usage.

import cytoscape from '../../build/dts/index.js';
import type { Animation, AnimationOptions, Core, NodeSingular } from '../../build/dts/index.js';

const cy: Core = cytoscape( { headless: false, styleEnabled: true, elements: [ { data: { id: 'a' } } ] } );

const opts: AnimationOptions = {
  duration: 1000,
  easing: 'ease-in-out',
  style: { 'background-color': 'red' },
  complete: () => {}
};

// cy.animation() and ele.animation() both return an Animation directly (no
// union to narrow), so it can be assigned and chained immediately.
const viewportAni: Animation = cy.animation( { zoom: 2, duration: 500 } );
const ele: NodeSingular = cy.nodes().first();
const eleAni: Animation = ele.animation( opts );
const delayAni: Animation = cy.delayAnimation( 200 );
const eleDelayAni: Animation = ele.delayAnimation( 200 );

// lifecycle methods return `this` (the Animation) for chaining
const chained: Animation = viewportAni.play().pause().rewind().fastforward().reverse().apply().stop();

// boolean state getters
const isPlaying: boolean = eleAni.playing();
const isApplying: boolean = eleAni.applying();
const isCompleted: boolean = eleAni.completed();

// progress()/time() are get/set overloads: no arg returns a number, arg returns this
const prog: number = eleAni.progress();
const progSet: Animation = eleAni.progress( 0.5 );
const t: number = eleAni.time();
const timeSet: Animation = eleAni.time( 100 );

// promise() resolves when the animation reaches the requested phase
eleAni.promise( 'completed' ).then( () => {} );

// documented aliases: run === play, running === playing, complete === completed
const ranAlias: Animation = eleAni.run();
const runningAlias: boolean = eleAni.running();
const completeAlias: boolean = eleAni.complete();

void [ cy, viewportAni, eleAni, delayAni, eleDelayAni, chained, isPlaying, isApplying, isCompleted,
  prog, progSet, t, timeSet, ranAlias, runningAlias, completeAlias ];
