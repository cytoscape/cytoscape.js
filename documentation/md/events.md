## Event object

Events passed to handler callbacks are similar to [jQuery event objects](http://api.jquery.com/category/events/event-object/) in that they wrap native event objects, mimicking their API.

Fields:

 * `cy` : a reference to the corresponding core instance
 * `target` : indicates the element or core that first caused the event
 * `type` : the event type string (e.g. `"tap"`)
 * `namespace` : the event namespace string (e.g. `"foo"` for `"tap.foo"`)
 * `timeStamp` : Unix epoch time of event in milliseconds

Fields for only user input device events:

 * `position` : indicates the model position of the event
 * `renderedPosition` : indicates the rendered position of the event
 * `originalEvent` : the original user input device event object

Fields for only layout events:

 * `layout` : indicates the corresponding layout that triggered the event (useful if running multiple layouts simultaneously)

## Event bubbling

All events that occur on elements get bubbled up to [compound parents](#notation/compound-nodes) and then to the core.  You must take this into consideration when binding to the core so you can differentiate between events that happened on the background and ones that happened on elements.  Use the `eventObj.target` field, which indicates the originator of the event (i.e. `eventObj.target === cy || eventObj.target === someEle`).


## User input device events

These are normal browser events that you can bind to via Cytoscape.js.  You can bind these events to the core and to collections.

 * `mousedown` : when the mouse button is pressed
 * `mouseup` : when the mouse button is released
 * `click` : after `mousedown` then `mouseup`
 * `mouseover` : when the cursor is put on top of the target
 * `mouseout` : when the cursor is moved off of the target
 * `mousemove` : when the cursor is moved somewhere on top of the target
 * `touchstart` : when one or more fingers starts to touch the screen
 * `touchmove` : when one or more fingers are moved on the screen
 * `touchend` : when one or more fingers are removed from the screen

There are also some higher level events that you can use so you don't have to bind to different events for mouse-input devices and for touch devices.

 * `tapstart` or `vmousedown` : normalised tap start event (either `mousedown` or `touchstart`)
 * `tapdrag` or `vmousemove` : normalised move event (either `touchmove` or `mousemove`)
 * `tapdragover` : normalised over element event (either `touchmove` or `mousemove`/`mouseover`)
 * `tapdragout` : normalised off of element event (either `touchmove` or `mousemove`/`mouseout`)
 * `tapend` or `vmouseup` : normalised tap end event (either `mouseup` or `touchend`)
 * `tap` or `vclick` : normalised tap event (either `click`, or `touchstart` followed by `touchend` without `touchmove`)
 * `taphold` : normalised tap hold event
 * `cxttapstart` : normalised right-click mousedown or two-finger `tapstart`
 * `cxttapend` : normalised right-click `mouseup` or two-finger `tapend`
 * `cxttap` : normalised right-click or two-finger `tap`
 * `cxtdrag` : normalised mousemove or two-finger drag after `cxttapstart` but before `cxttapend`
 * `cxtdragover` : when going over a node via `cxtdrag`
 * `cxtdragout` : when going off a node via `cxtdrag`
 * `boxstart` : when starting box selection
 * `boxend` : when ending box selection
 * `boxselect` : triggered on elements when selected by box selection
 * `box` : triggered on elements when inside the box on `boxend`


## Collection events

These events are custom to Cytoscape.js.  You can bind to these events for collections.

 * `add` : when an element is added to the graph
 * `remove` : when an element is removed from the graph
 * `select` : when an element is selected
 * `unselect` : when an element is unselected
 * `lock` : when an element is locked
 * `unlock` : when an element is unlocked
 * `grabon` : when an element is grabbed directly (including only the one node directly under the cursor or the user's finger)
 * `grab` : when an element is grabbed (including all elements that would be dragged)
 * `drag` : when an element is grabbed and then moved
 * `free` : when an element is freed (i.e. let go from being grabbed)
 * `position` : when an element changes position
 * `data` : when an element's data is changed
 * `scratch` : when an element's scratchpad data is changed
 * `style` : when an element's style is changed
 * `background` : when a node's background image is loaded


## Graph events

These events are custom to Cytoscape.js, and they occur on the core.

 * `layoutstart` : when a layout starts running
 * `layoutready` : when a layout has set initial positions for all the nodes (but perhaps not final positions)
 * `layoutstop` : when a layout has finished running completely or otherwise stopped running
 * `ready` : when a new instance of Cytoscape.js is ready to be interacted with
 * `destroy` : when the instance of Cytoscape.js was explicitly destroyed by calling `.destroy()`.
 * `render` : when the viewport is (re)rendered
 * `pan` : when the viewport is panned
 * `zoom` : when the viewport is zoomed
 * `viewport` : when the viewport is changed (i.e. from a `pan`, a `zoom`, or from both when zooming about a point -- e.g. pinch-to-zoom)
 * `resize` : when the viewport is resized (usually by calling `cy.resize()`, a `window` resize, or toggling a class on the Cytoscape.js div)
