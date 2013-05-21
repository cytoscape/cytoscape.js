## Event object

Events passed to handler callbacks are [jQuery-event-like objects](http://api.jquery.com/category/events/event-object/).  They have an additional field named `cyTarget`, which indicates the element or core that first caused the event.

## User input device events

These are normal browser events that you can bind to via Cytoscape.js.  You can bind these events to the core and to collections.

 * `mousedown` : when the mouse button is pressed
 * `mouseup` : when the mouse button is released
 * `click` : after mousedown then mouseup
 * `mouseover` : when the cursor is put on top of the target
 * `mouseout` : when the cursor is moved off of the target
 * `mousemove` : when the cursor is moved somewhere on top of the target
 * `touchstart` : when one or more fingers starts to touch the screen
 * `touchmove` : when one or more fingers are moved on the screen
 * `touchend` : when one or more fingers are removed from the screen

There are also some higher level events that you can use so you don't have to bind to different events for mouse-input devices and for touch devices.

 * `tapstart` or `vmousedown` : normalised tap start event (either `mousedown` or `touchstart`)
 * `tapend` or `vmouseup` : normalised tap end event (either `mouseup` or `touchend`)
 * `tap` or `vclick` : normalised tap event (either `click`, or `touchstart` followed by `touchend` without `touchmove`)
 * `taphold` : normalised tap hold event
 * `cxttapstart` : normalised right-click mousedown or two-finger tapstart
 * `cxttapend` : normalised right-click mouseup or two-finger tapend
 * `cxttap` : normalised right-click or two-finger tap
 * `cxtdrag` : normalised mousemove or two-finger drag after `cxttapstart` but before `cxttapend`

## Collection events

These events are custom to Cytoscape.js.  You can bind to these events for collections.

 * `select` : when an element is selected
 * `unselect` : when an element is unselected
 * `lock` : when an element is locked
 * `unlock` : when an element is unlocked
 * `grab` : when an element is grabbed by the mouse cursor or a finger on a touch input
 * `drag` : when an element is grabbed and then moved
 * `free` : when an element is freed (i.e. let go from being grabbed)
 * `position` : when an element changes position
 * `data` : when an element's data is changed
 * `bypass` : when an element's bypass is changed
 * `add` : when an element is added to the graph
 * `remove` : when an element is removed from the graph

## Graph events

These events are custom to Cytoscape.js, and they occur on the core.

 * `layoutstart` : when a layout starts running
 * `layoutready` : when a layout has set positions for all the nodes
 * `layoutstop` : when a layout has finished running completely or otherwise stopped running
 * `load` : when a new graph is loaded via initialisation or `cy.load()`
 * `ready` : when a new instance of Cytoscape.js is ready to be interacted with
 * `done` : when a new instance of Cytoscape.js is ready to be interacted with and its initial layout has finished running
 * `pan` : when the viewport is panned
 * `zoom` : when the viewport is zoomed

