## About

Cytoscape.js is an open-source [graph](http://en.wikipedia.org/wiki/Graph_theory)  library written in JavaScript.  You can use Cytoscape.js for graph analysis and visualisation.

Cytoscape.js allows you to easily display graphs in your websites.  Because Cytoscape.js allows the user to interact with the graph and the library allows the client to hook into user events, Cytoscape.js is easily integrated into your webapp, especially since Cytoscape.js supports both desktop browsers, like Chrome, and mobile browsers, like on the iPad.

Cytoscape.js also has graph analysis in mind:  The library contains a slew of useful functions in graph theory.  You can use Cytoscape.js headlessly on Node.js to do graph analysis in the terminal or on a web server.

The library was developed at the [Donnelly Centre](http://tdccbr.med.utoronto.ca/) at the [University of Toronto](http://www.utoronto.ca/).



## Cytoscape.js & Cytoscape

Though Cytoscape.js shares its name with [Cytoscape](http://www.cytoscape.org/), Cytoscape.js is not Cytoscape.  Cytoscape.js is a JavaScript library for _programmers_.  It is not an app for end-users, nor can you just copy-paste some code to "automagically" make you a webapp.

Cytoscape.js is a JavaScript library:  It gives you a reusable graph widget that you can integrate with the rest of your webapp with your own JavaScript code.  The keen members of the audience will point out that this means that Cytoscape plugins &mdash; written in Java &mdash; will obviously not work in Cytoscape.js &mdash; written in Java_Script_.

We do follow some similar philosophies with Cytoscape:  Graph style and data should be separate, and the library should provide core functionality with extensions adding functionality on top of the library.
