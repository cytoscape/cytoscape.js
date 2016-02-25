## Factsheet

 * A fully featured graph library written in pure JS
 * Permissive open source license (MIT)
 * Designed for users first, for both frontfacing app usercases *and* developer usecases
 * Highly optimised
 * Dependency free
 * Compatible with
  * All modern browsers
  * CommonJS/Node.js
  * AMD/Require.js
  * jQuery
  * npm
  * Bower
  * spm
  * Meteor/Atmosphere
 * Has a full suite of unit tests that can be run in the browser or the terminal
 * Documentation includes live code examples, doubling as an interactive requirements specification; example graphs may also be freely modified in your browser's JS console
 * Fully serialisable and deserialisable via JSON
 * Uses layouts for automatically or manually positioning nodes
 * Supports selectors for terse filtering and graph querying
 * Uses stylesheets to separate presentation from data in a rendering agnostic manner
 * Abstracted and unified touch events on top of a familiar event model
 * Builtin support for standard gestures on both desktop and touch
 * Chainable for convenience
 * Supports functional programming patterns
 * Supports set theory operations
 * Includes graph theory algorithms, from BFS to PageRank
 * Animatable graph elements and viewport
 * Fully extendable (and extensions can be autoscaffolded for you)
 * Well maintained, with only a sliver of active bug time (i.e. minimised time to bugfix)
 * Used by
  * [Aras](http://www.aras.com/)
  * [BioGRID](http://thebiogrid.org/)
  * [Cray Inc.](http://www.cray.com)
  * [CyNetShare](http://cynetshare.ucsd.edu/)
  * [DARPA XDATA](http://www.darpa.mil/opencatalog/xdata.html) / [Sotera Defense Solutions, Inc.](http://sotera.github.io/graphene/)
  * [dSysMap](http://dsysmap.irbbarcelona.org)
  * [Elsevier](https://www.elsevier.com)
  * [Excel](https://products.office.com/en-us/excel) : [GIGRAPH](https://gigraph.io)
  * [Ganister](http://www.ganister.eu/)
  * [GeneMANIA](http://genemania.org)
  * [InfoTrack](http://www.infotrack.com.au/)
  * [Kartoteka](http://www.kartoteka.ru/vizual/)
  * [NDex](http://home.ndexbio.org/)
  * [Pathway Commons](http://www.pathwaycommons.org)
  * [py2cytoscape](https://github.com/idekerlab/py2cytoscape)
  * [Sainsbury Laboratory](http://www.tsl.ac.uk/) : [PINet](http://pinet.tsl.ac.uk/)
  * [University of Cambridge](http://www.cam.ac.uk/) : [Intermine](http://intermine.org/)
  * [Visual Interaction GmbH](http://www.mygaze.com/)
  


## About

Cytoscape.js is an open-source [graph theory](http://en.wikipedia.org/wiki/Graph_theory) (a.k.a. network) library written in JavaScript.  You can use Cytoscape.js for graph analysis and visualisation.

Cytoscape.js allows you to easily display and manipulate rich, interactive graphs.  Because Cytoscape.js allows the user to interact with the graph and the library allows the client to hook into user events, Cytoscape.js is easily integrated into your app, especially since Cytoscape.js supports both desktop browsers, like Chrome, and mobile browsers, like on the iPad.  Cytoscape.js includes all the gestures you would expect out-of-the-box, including pinch-to-zoom, box selection, panning, et cetera.

Cytoscape.js also has graph analysis in mind:  The library contains many useful functions in graph theory.  You can use Cytoscape.js headlessly on Node.js to do graph analysis in the terminal or on a web server.

Cytoscape.js is an open-source project, and anyone is free to contribute.  For more information, refer to the [GitHub README](https://github.com/cytoscape/cytoscape.js).

The library was developed at the [Donnelly Centre](http://thedonnellycentre.utoronto.ca) at the [University of Toronto](http://www.utoronto.ca/).  It is the successor of [Cytoscape Web](http://cytoscapeweb.cytoscape.org/).



## Packages

 * npm : `npm install cytoscape`
 * bower : `bower install cytoscape`
 * spm : `spm install cytoscape`
 * jspm : `jspm install npm:cytoscape`
 * meteor : `meteor add cytoscape:cytoscape`


## Cytoscape.js & Cytoscape

Though Cytoscape.js shares its name with [Cytoscape](http://www.cytoscape.org/), Cytoscape.js is not exactly the same as Cytoscape desktop.  Cytoscape.js is a JavaScript library for _programmers_.  It is not an app for end-users, and developers need to write code around Cytoscape.js to build graphcentric apps.

Cytoscape.js is a JavaScript library:  It gives you a reusable graph widget that you can integrate with the rest of your app with your own JavaScript code.  The keen members of the audience will point out that this means that Cytoscape plugins/apps &mdash; written in Java &mdash; will obviously not work in Cytoscape.js &mdash; written in Java_Script_.  However, Cytoscape.js supports its own ecosystem of extensions.

We are trying to make the two projects intercompatible as possible, and we do share philosophies with Cytoscape:  Graph style and data should be separate, the library should provide core functionality with extensions adding functionality on top of the library, and so on.



## Funding

Funding for Cytoscape.js and Cytoscape is provided by NRNB (U.S. National Institutes of Health, National Center for Research Resources grant numbers P41 RR031228 and GM103504) and by NIH grants 2R01GM070743 and 1U41HG006623. The following organizations help develop Cytoscape:


[ISB](http://www.systemsbiology.org) |
[UCSD](http://www.ucsd.edu) |
[MSKCC](http://cbio.mskcc.org) |
[Pasteur](http://www.pasteur.fr) |
[Agilent](http://www.agilent.com/) |
[UCSF](http://www.ucsf.edu/) |
[Unilever](http://www.unilever.com) |
[Toronto](http://www.utoronto.ca) |
[NCIBI](http://portal.ncibi.org/gateway/index.html) |
[NRNB](http://nrnb.org)
