# Cytoscape.js

Graph theory (a.k.a. network) library for analysis and visualisation : [http://js.cytoscape.org](http://js.cytoscape.org)



## Test status

[![Build Status](https://travis-ci.org/cytoscape/cytoscape.js.svg?branch=master)](https://travis-ci.org/cytoscape/cytoscape.js) : `master`

[![Build Status](https://travis-ci.org/cytoscape/cytoscape.js.svg?branch=unstable)](https://travis-ci.org/cytoscape/cytoscape.js) : `unstable`



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

 1. Update the `VERSION` environment variable, e.g. `export VERSION=1.2.3`
 1. Confirm JS files pass linting: `gulp lint`
 1. Confirm all tests passing: `gulp test`
 1. Test the docs and demos with the latest code: `gulp docspub`
 1. Build and publish the release: `gulp publish`



## Tests

Mocha tests are found in the [test directory](https://github.com/cytoscape/cytoscape.js/tree/master/test).  The tests can be run in the browser or they can be run via Node.js (`gulp test`).




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
