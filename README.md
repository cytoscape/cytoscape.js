# Cytoscape.js

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/cytoscape/cytoscape.js/master/LICENSE)
[![npm](https://img.shields.io/npm/v/cytoscape.svg?maxAge=2592000)](https://www.npmjs.com/package/cytoscape)
[![npm installs](https://img.shields.io/npm/dt/cytoscape.svg?maxAge=2592000&label=npm installs)](https://www.npmjs.com/package/cytoscape)
[![master branch tests](https://img.shields.io/travis/cytoscape/cytoscape.js/master.svg?maxAge=2592000&label=master%20branch)](https://travis-ci.org/cytoscape/cytoscape.js)
[![unstable branch tests](https://img.shields.io/travis/cytoscape/cytoscape.js/unstable.svg?maxAge=2592000&label=unstable%20branch)](https://travis-ci.org/cytoscape/cytoscape.js)
[![StackOverflow](https://img.shields.io/stackexchange/stackoverflow/t/cytoscape.js.svg?maxAge=2592000)](http://stackoverflow.com/questions/tagged/cytoscape.js)
[![StackOverflow](https://img.shields.io/badge/ask%20question-on%20stackoverflow-brightgreen.svg?maxAge=2592000)](http://stackoverflow.com/questions/ask?tags=cytoscape.js)
[![Gitter](https://img.shields.io/gitter/room/cytoscape/cytoscape.js.svg?maxAge=2592000)](https://gitter.im/cytoscape/cytoscape.js)


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



## Roadmap

Future versions of Cytoscape.js are planned in the [milestones of the Github issue tracker](https://github.com/cytoscape/cytoscape.js/milestones).  You can use the milestones to see what's currently planned for future releases.




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
