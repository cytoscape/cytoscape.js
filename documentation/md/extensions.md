You can use an extension (e.g. `cy-ext`) as follows with `cytoscape.use()`:

```js
cytoscape.use( require('cy-ext') );
```

Using `import`, the above example would be:

```js
import ext from 'cy-ext';

cytoscape.use( ext );
```

The extensions below are a curated list.  To add your extension, [please submit a request](https://github.com/cytoscape/cytoscape.js/issues/new?labels=documentation&title=List%20extension%20:%20%3Cyour%20extension%20name%3E&body=Please%20enter%20your%20Github%20URL%20and%20a%20one-line%20description) that includes your extension's URL and a one line description.

<i class="fa fa-fw fa-user"></i> denotes a first-party extension, one that is maintained by groups associated with the Cytoscape Consortium.

<i class="fa fa-fw fa-users"></i> denotes a third-party extension, one that is maintained by outside developers.

## UI extensions

 * <i class="fa fa-fw fa-users"></i> [`anywhere-panning`](https://github.com/lambdalisue/cytoscape-anywhere-panning) : Allow panning when dragging on nodes or edges.
 * <i class="fa fa-fw fa-user"></i> [`automove`](https://github.com/cytoscape/cytoscape.js-automove) : Automatically update node positions based on specified rules (e.g. synching node movements, constraining movements, etc.)
 * <i class="fa fa-fw fa-user"></i> [`autopan-on-drag`](https://github.com/iVis-at-Bilkent/cytoscape.js-autopan-on-drag) : Automatically pan the viewport when nodes are dragged outside of the viewport bounds.
 * <i class="fa fa-fw fa-users"></i> [`blink`](https://github.com/simCecca/cytoscape-blink) : Make elements blink.
 * <i class="fa fa-fw fa-users"></i> [`bubblesets`](https://github.com/sgratzl/cytoscape.js-bubblesets) : Visually group a set of elements via a [bubble set](https://ieeexplore.ieee.org/document/5290706).
 * <i class="fa fa-fw fa-users"></i> [`canvas`](https://github.com/classcraft/cytoscape.js-canvas) : An extension to create a canvas over or under a Cytoscape graph. Useful for customizing nodes/edges, drawing backgrounds, etc.
 * <i class="fa fa-fw fa-users"></i> [`cerebralweb`](https://github.com/silviafrias/cerebral-web) : Enable fast and interactive visualisation of molecular interaction networks stratified based on subcellular localisation or other custom annotation.
 * <i class="fa fa-fw fa-user"></i> [`compound-drag-and-drop`](https://github.com/cytoscape/cytoscape.js-compound-drag-and-drop) : Compound node drag-and-drop UI for adding and removing children
 * <i class="fa fa-fw fa-user"></i> [`context-menus`](https://github.com/iVis-at-Bilkent/cytoscape.js-context-menus) : A traditional right click menu
 * <i class="fa fa-fw fa-user"></i> [`cxtmenu`](https://github.com/cytoscape/cytoscape.js-cxtmenu) : A circular context menu that allows for one-swipe commands on the graph.
 * <i class="fa fa-fw fa-users"></i> [`dom-node`](https://github.com/mwri/cytoscape-dom-node) : Use an HTML element as a node's body.
 * <i class="fa fa-fw fa-user"></i> [`edge-editing`](https://github.com/iVis-at-Bilkent/cytoscape.js-edge-editing) : UI for editing edge bends (segment edges and bezier edges)
 * <i class="fa fa-fw fa-users"></i> [`edge-editation`](https://github.com/frankiex/cytoscape.js-edge-editation) : Adds handles to nodes and allows creation of different types of edges
 * <i class="fa fa-fw fa-users"></i> [`edge-connections`](https://github.com/jri/cytoscape-edge-connections) : Allows edges to visually connect other edges, according to the Associative Model of Data.
 * <i class="fa fa-fw fa-user"></i> [`edgehandles`](https://github.com/cytoscape/cytoscape.js-edgehandles) : UI for connecting nodes with edges.
 * <i class="fa fa-fw fa-users"></i> [`even-parent`](https://github.com/mo0om/cytoscape-even-parent) : Layout which resizes children to fit under parent no matter how many there are.
 * <i class="fa fa-fw fa-user"></i> [`expand-collapse`](https://github.com/iVis-at-Bilkent/cytoscape.js-expand-collapse) : Provides an API for expanding and collapsing compound parent nodes
 * <i class="fa fa-fw fa-user"></i> [`grid-guide`](https://github.com/iVis-at-Bilkent/cytoscape.js-grid-guide) : Adds grid and snapping functionality to Cytoscape graphs
 * <i class="fa fa-fw fa-users"></i> [`html`](https://github.com/BradyDouthit/cytoscape-html) : Allows for nodes to be rendered via HTML.
 * <i class="fa fa-fw fa-users"></i> [`lasso`](https://github.com/zakjan/cytoscape-lasso) : Lasso selection UI
 * <i class="fa fa-fw fa-users"></i> [`layers`](https://github.com/sgratzl/cytoscape.js-layers) : Simplifies the creation and management of additional layers in SVG, HTML, or Canvas format with additional utilities to render elements per node or edge.
 * <i class="fa fa-fw fa-user"></i> [`leaf`](https://github.com/cytoscape/cytoscape.js-leaflet) : Allow for Leaflet maps to be shown underneath Cytoscape visualisations.
 * <i class="fa fa-fw fa-users"></i> [`mapbox-gl`](https://github.com/zakjan/cytoscape-mapbox-gl) : Display a Cytoscape graph on top of a Mapbox GL map.
 * <i class="fa fa-fw fa-user"></i> [`navigator`](https://github.com/cytoscape/cytoscape.js-navigator) : A bird's eye view widget of the graph.
 * <i class="fa fa-fw fa-users"></i> [`no-overlap`](https://mo0om.github.io/cytoscape-no-overlap) : Prevents nodes from overlapping on drag.
 * <i class="fa fa-fw fa-users"></i> [`node-html-label`](https://github.com/kaluginserg/cytoscape-node-html-label) : Allows HTML to be specified as the labels for nodes.
 * <i class="fa fa-fw fa-user"></i> [`node-resize`](https://github.com/iVis-at-Bilkent/cytoscape.js-node-resize) : A highly customisable node resizing extension with a traditional UI.
 * <i class="fa fa-fw fa-users"></i> [`noderesize`](https://github.com/curupaco/cytoscape.js-noderesize) : A minimalistic node resize control.
 * <i class="fa fa-fw fa-users"></i> [`overlays`](https://github.com/sgratzl/cytoscape.js-overlays) : Overlays that shows bars, histograms, sparklines, binary sparklines, symbols (categorical data), or boxplots next to nodes.
 * <i class="fa fa-fw fa-user"></i> [`panzoom`](https://github.com/cytoscape/cytoscape.js-panzoom) : A panzoom UI widget.
 * <i class="fa fa-fw fa-user"></i> [`popper`](https://github.com/cytoscape/cytoscape.js-popper) : A wrapper for [Popper.js](https://popper.js.org/) that lets you position divs relative to Cytoscape elements (can be used with [Tippy.js](https://atomiks.github.io/tippyjs/) to create tooltips).
 * <i class="fa fa-fw fa-user"></i> [`qtip`](https://github.com/cytoscape/cytoscape.js-qtip) : A wrapper that lets you use qTips on graph elements or the graph background.
 * <i class="fa fa-fw fa-users"></i> [`snap-to-grid`](https://github.com/guimeira/cytoscape-snap-to-grid) : Adds snap-to-grid and gridlines to Cytoscape.js graphs.
 * <i class="fa fa-fw fa-users"></i> [`supportimages`](https://github.com/jhonatandarosa/cytoscape.js-supportimages) : Support images on Cytoscape.js.
 * <i class="fa fa-fw fa-users"></i> [`toolbar`](https://github.com/bdparrish/cytoscape.js-toolbar) : Allow a user to create a custom toolbar to add next to a Cytoscape core instance.


## Layout extensions

 * <i class="fa fa-fw fa-user"></i> [`cola`](https://github.com/cytoscape/cytoscape.js-cola) : The Cola.js physics simulation (force-directed) layout.  Cola makes beautiful layout results, it animates very smoothly, and it has great options for controlling the layout.  It is focussed on giving aesthetically pleasing results for relatively small graphs.
 * <i class="fa fa-fw fa-user"></i> [`avsdf`](https://github.com/iVis-at-Bilkent/cytoscape.js-avsdf) : The AVSDF layout.  It organises nodes in a circle and tries to minimise edge crossings as much as possible.
 * <i class="fa fa-fw fa-user"></i> [`cise`](https://github.com/iVis-at-Bilkent/cytoscape.js-cise) : The CiSE layout creates circular clusters and uses a physics simulation (force-directed algorithm) to create distance between the clusters.
 * <i class="fa fa-fw fa-user"></i> [`cose-bilkent`](https://github.com/cytoscape/cytoscape.js-cose-bilkent) : The CoSE layout by Bilkent with enhanced compound node placement.  CoSE Bilkent is a physics simulation (force-directed) layout that gives near-perfect end results.  However, it's more expensive than both `cose` and `fcose`.
 * <i class="fa fa-fw fa-user"></i> [`cosep`](https://github.com/iVis-at-Bilkent/cytoscape.js-cosep) : 
Compound Spring Embedder with Ports (CoSEP) is a force-directed layout algorithm based on the CoSE (Compound Spring Embedder) to support port constraints on compound graphs.
 * <i class="fa fa-fw fa-users"></i> [`cosmos-over-cytoscape`](https://github.com/simCecca/cosmosOverCytoscape) : 
A physics simulation layout that makes use of parallelism on the GPU to support large graphs.
 * <i class="fa fa-fw fa-users"></i> [`d3-force`](https://github.com/shichuanpo/cytoscape.js-d3-force) : The D3 force layout.  It uses a basic physics simulation (force-directed) algorithm that generates good results for small, simple graphs.
 * <i class="fa fa-fw fa-user"></i> [`dagre`](https://github.com/cytoscape/cytoscape.js-dagre) : The Dagre layout for DAGs and trees.  It organises the graph in a hierarchy.
 * <i class="fa fa-fw fa-user"></i> [`elk`](https://github.com/cytoscape/cytoscape.js-elk) : [ELK](https://github.com/OpenKieler/elkjs) layout algorithm adapter for Cytoscape.js.  It contains several layout algorithms.
 * <i class="fa fa-fw fa-user"></i> [`euler`](https://github.com/cytoscape/cytoscape.js-euler) : Euler is a fast, small file-size, high-quality force-directed (physics simulation) layout.  It is good for non-compound graphs, and it has basic support for compound graphs.
 * <i class="fa fa-fw fa-user"></i> [`fcose`](https://github.com/iVis-at-Bilkent/cytoscape.js-fcose) : The fCoSE layout is a faster version of the CoSE-Bilkent layout.  It supports compound and non-compound graphs, giving top-tier end results and high performance for a force-directed layout.  In addition, fCoSE supports user-specified constraints of the following types on nodes: fixed position, alignment and relative placement.  If you want to use a force-directed layout, fCoSE should be the first layout you try.
 * <i class="fa fa-fw fa-user"></i> [`klay`](https://github.com/cytoscape/cytoscape.js-klay) : Klay is a layout that works well for most types of graphs.  It gives good results for ordinary graphs, and it handles DAGs and compound graphs very nicely.
 * <i class="fa fa-fw fa-users"></i> [`ngraph.forcelayout`](https://github.com/Nickolasmv/cytoscape-ngraph.forcelayout) : A physics simulation layout that works particularly well on planar graphs.  It is relatively fast.
 * <i class="fa fa-fw fa-users"></i> [`polywas`](https://github.com/monprin/polywas) : A layout for GWAS (genome-wide association study) data illustrating inter-locus relationships.
 * <i class="fa fa-fw fa-user"></i> [`spread`](https://github.com/cytoscape/cytoscape.js-spread) : The Spread physics simulation (force-directed) layout tries to use all the viewport space, but it can be configured to produce a tighter result.  It uses the CoSE algorithm initially, and it uses Gansner and North for the spread phase.
 * <i class="fa fa-fw fa-user"></i> [`springy`](https://github.com/cytoscape/cytoscape.js-springy) : The Springy physics simulation layout.  It's a basic physics (force-directed) layout.
 * <i class="fa fa-fw fa-users"></i> [`tidytree`](https://github.com/chuckzel/cytoscape-tidytree) : A layout specifically for trees that allows for a non-layered layout.


## API extensions

 * <i class="fa fa-fw fa-users"></i> [`all-paths`](https://github.com/daniel-dx/cytoscape-all-paths) : Gets all longest, directed paths.
 * <i class="fa fa-fw fa-user"></i> [`clipboard`](https://github.com/iVis-at-Bilkent/cytoscape.js-clipboard) : Adds copy-paste utilities to Cytoscape.js.
 * <i class="fa fa-fw fa-users"></i> [`dblclick`](https://github.com/lambdalisue/cytoscape-dblclick) : Adds a `dblclick` event to Cytoscape.js.
 * <i class="fa fa-fw fa-user"></i> [`graphml`](https://github.com/iVis-at-Bilkent/cytoscape.js-graphml) : Adds GraphML import and export functionality to Cytoscape.js.
 * <i class="fa fa-fw fa-user"></i> [`layout-utilities`](https://github.com/iVis-at-Bilkent/cytoscape.js-layout-utilities) : Provides miscellenaous layout utilities in order to manage the placement of nodes or components without layout information.
 * <i class="fa fa-fw fa-user"></i> [`undo-redo`](https://github.com/iVis-at-Bilkent/cytoscape.js-undo-redo) : Adds undo-redo APIs to Cytoscape.js.
 * <i class="fa fa-fw fa-user"></i> [`view-utilities`](https://github.com/iVis-at-Bilkent/cytoscape.js-view-utilities) : Adds search and highlight APIs to Cytoscape.js.

## Utility packages

 * <i class="fa fa-fw fa-users"></i> [`Cytoscape.js Schema`](https://github.com/AZaitzeff/cytoscape_js_schema) : A JSON Schema for the Cytoscape.js JSON graph format.
 * <i class="fa fa-fw fa-user"></i> [`cytosnap`](https://github.com/cytoscape/cytosnap) : A Node.js package that renders images of Cytoscape.js graphs on the server using Puppeteer.
 * <i class="fa fa-fw fa-users"></i> [`Cyjs.NET`](https://fslab.org/Cyjs.NET/) : An interface for Cytoscape.js in F#.
 * <i class="fa fa-fw fa-users"></i> [`ngx-cytoscape`](https://github.com/calvinvette/ngx-cytoscape) : An Angular 5+ component for Cytoscape.js.
 * <i class="fa fa-fw fa-user"></i> [`react-cytoscapejs`](https://github.com/plotly/react-cytoscapejs) : A [React](https://reactjs.org) component for Cytoscape.js network visualisations.
 * <i class="fa fa-fw fa-users"></i> [`cytoscape-react`](https://github.com/mwri/cytoscape-react) : Create `<Node>`s and `<Edge>s` specified with JSX.
 * <i class="fa fa-fw fa-users"></i> [`sif.js`](https://github.com/jmvillaveces/sif.js) : A javascript library to parse simple interaction file (SIF) files.
 * <i class="fa fa-fw fa-user"></i> [`sbgn-stylesheet`](https://github.com/PathwayCommons/cytoscape-sbgn-stylesheet) : A stylesheet preset for [SBGN](https://sbgn.github.io/sbgn/).
 * <i class="fa fa-fw fa-user"></i> [`sbgnml-to-cytoscape`](https://github.com/PathwayCommons/sbgnml-to-cytoscape) : Converts XML-based [SBGN](https://sbgn.github.io/sbgn/) files to Cytoscape.js JSON.
 * <i class="fa fa-fw fa-users"></i> [`vue-cytoscape`](https://www.npmjs.com/package/vue-cytoscape) : A [Vue](https://vuejs.org) component for Cytoscape.js.
 * <i class="fa fa-fw fa-users"></i> [`cytoscape-pptx`](https://github.com/Hoogkamer/cytoscape-pptx) : Export a Cytoscape.js graph into a Powerpoint slide.


## Registration

To register an extension, make the following call: `cytoscape( type, name, extension );`

The value of `type` can take on the following values:

 * `'core'` : The extension adds a core function.
 * `'collection'` : The extension adds a collection function.
 * `'layout'` : The extension registers a layout prototype.

The `name` argument indicates the name of the extension, e.g.: the following code registers `eles.fooBar()`:

```
cytoscape('collection', 'fooBar', function(){
  return 'baz';
});`
```



## Project setup

1. Create a repository on GitHub for your extension's code
1. Use [rollup-starter-lib](https://github.com/rollup/rollup-starter-lib) to create the project's scaffolding.  Alternatively, manually generate the project configuration files with your favourite bundler.
1. Use [Babel](https://babeljs.io) if you want to support older browsers with your extension.  The `rollup-starter-lib` repo has an example in the [`babel` branch](https://github.com/rollup/rollup-starter-lib/tree/babel).
1. The default export of your extension should be a registration function, e.g.:
  ```
  export default function register(cytoscape){
    cytoscape('collection', 'fooBar', fooBarFunction);
  }
  ```
1. You may want to support automatic registration for consumers who use traditional `<script>` tags to use your extension, i.e.:
  ```
  if(typeof window.cytoscape !== 'undefined'){
    register(window.cytoscape);
  }
  ```
1. Document your extension's API in a `README.md` file in the root directory of your respository.
1. [Publish your extension to npm](https://docs.npmjs.com/cli/publish).
1. [Submit a request](https://github.com/cytoscape/cytoscape.js/issues/new?labels=documentation&title=List%20extension%20:%20%3Cyour%20extension%20name%3E&body=Please%20enter%20your%20Github%20URL%20and%20a%20one-line%20description) to have your extension listed in the documentation.

## Layout prototype

- `constructor(options)` : Create the layout
  - `options` : The layout options, special fields include:
    - `options.cy` : The Cytoscape graph
    - `options.eles` : The collection of elements passed to the layout
- `run()` : Run the layout
  - `run()` calls `eles.layoutPositions()` to set the final layout positions, if the layout is discrete.
  - `run()` starts the async layout, if the layout is continuous (e.g. a force-directed layout, which runs over several layout iterations).
  - A continuous layout may use a [worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) for layout calculations or it may run several layout iterations per call of [`requestAnimationFrame()`](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame).
  - Each visible iteration of a continuous layout may set [`nodes.positions()`](#nodes.positions).
- `stop()` : Stop the layout
  - This function is specified only for continuous layouts.
