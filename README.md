# Cytoscape.js

[![Build Status](https://travis-ci.org/cytoscape/cytoscape.js.svg?branch=master)](https://travis-ci.org/cytoscape/cytoscape.js) [![Build Status](https://travis-ci.org/cytoscape/cytoscape.js.svg?branch=unstable)](https://travis-ci.org/cytoscape/cytoscape.js)  
*(master branch, unstable branch)* 


Graph theory (a.k.a. network) library for analysis and visualisation : [http://js.cytoscape.org](http://js.cytoscape.org)



## Description

Cytoscape.js is a fully featured [graph theory](https://en.wikipedia.org/wiki/Graph_theory) library.  Do you need to model and/or visualise relational data, like biological data or social networks?  If so, Cytoscape.js is just what you need.

Cytoscape.js contains a graph theory model and an optional renderer to display interactive graphs.  This library was designed to make it as easy as possible for programmers and scientists to use graph theory in their apps, whether it's for server-side analysis in a Node.js app or for a rich user interface.

You can get started with Cytoscape.js with one line:

```js
var cy = cytoscape({ elements: myElements, container: myDiv });
```

Learn more about the features of Cytoscape.js by reading [its documentation](http://js.cytoscape.org).





## Documentation

You can find the documentation and downloads on the [project website](http://js.cytoscape.org).




## Contributing to Cytoscape.js

Please refer to [CONTRIBUTING.md](CONTRIBUTING.md).




## Build dependencies

Install `node`, `npm` and `gulp`.  Of course, `npm install` before using `gulp`.




## Build instructions

Run `gulp <target>` in the console.  The main targets are:

**Building:**

 * `build` (default) : build the library
 * `clean` : clean the `build` directory
 * `watch` : automatically build lib and tests for debugging
 * `zip` : build the release ZIP
 * `dist` : update the distribution JS for npm, bower, etc.

**Testing:**

 * `test` : run the Mocha unit tests
 * `lint` : lint the JS sources via jshint
 * `benchmark` : run benchmark regression tests
 * `benchmark-single` : run benchmarks only for the suite specified in `benchmark/single`
 * `sniper` : runs a BioJS sniper server that hosts demos

**Documentation:**

 * `docs` : build the documentation template
 * `docsmin` : build the documentation template with all resources minified
 * `docspub` : build the documentation for publishing (ZIPs, JS refs, etc.)
 * `docspush` : push the built documentation to [js.cytoscape.org](http://js.cytoscape.org)
 * `unstabledocspush` : push the built documentation to [js.cytoscape.org/unstable](http://js.cytoscape.org/unstable)




## Release instructions

 1. Make sure the docs are updated with the list of releases in `documentation/md/intro.md`
 1. Update the `VERSION` environment variable, e.g. `export VERSION=1.2.3`
 1. Confirm JS files pass linting: `gulp lint`
 1. Confirm all tests passing: `gulp test`
 1. Test the docs and demos with the latest code: `gulp docspub`
 1. Build and publish the release: `gulp publish`



## Tests

Mocha tests are found in the [test directory](https://github.com/cytoscape/cytoscape.js/tree/master/test).  The tests can be run in the browser or they can be run via Node.js (`gulp test` or `mocha`).
