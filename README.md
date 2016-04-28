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



## Releases

- [2.6.10](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.6.10+is%3Aclosed)
- [2.6.9](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.6.9+is%3Aclosed)
- [2.6.8](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.6.8+is%3Aclosed)
- [2.6.7](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.6.7+is%3Aclosed)
- [2.6.6](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.6.6+is%3Aclosed)
- [2.6.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.6.5+is%3Aclosed)
- [2.6.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.6.4+is%3Aclosed)
- [2.6.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.6.3+is%3Aclosed)
- [2.6.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.6.2+is%3Aclosed)
- [2.6.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.6.1+is%3Aclosed)
- [2.6.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.6.0+is%3Aclosed)
- [2.5.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.5.5+is%3Aclosed)
- [2.5.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.5.4+is%3Aclosed)
- [2.5.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.5.3+is%3Aclosed)
- [2.5.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.5.2+is%3Aclosed)
- [2.5.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.5.1+is%3Aclosed)
- [2.5.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.5.0+is%3Aclosed)
- [2.4.9](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.4.9+is%3Aclosed)
- [2.4.8](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.4.8+is%3Aclosed)
- [2.4.7](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.4.7+is%3Aclosed)
- [2.4.6](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.4.6+is%3Aclosed)
- [2.4.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.4.5+is%3Aclosed)
- [2.4.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.4.4+is%3Aclosed)
- [2.4.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.4.3+is%3Aclosed)
- [2.4.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.4.2+is%3Aclosed)
- [2.4.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.4.1+is%3Aclosed)
- [2.4.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.4.0+is%3Aclosed)
- [2.3.16](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.16+is%3Aclosed)
- [2.3.15](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.15+is%3Aclosed)
- [2.3.14](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.14+is%3Aclosed)
- [2.3.13](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.13+is%3Aclosed)
- [2.3.11](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.11+is%3Aclosed)
- [2.3.10](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.10+is%3Aclosed)
- [2.3.9](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.9+is%3Aclosed)
- [2.3.8](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.8+is%3Aclosed)
- [2.3.7](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.7+is%3Aclosed)
- [2.3.6](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.6+is%3Aclosed)
- [2.3.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.5+is%3Aclosed)
- [2.3.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.4+is%3Aclosed)
- [2.3.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.3+is%3Aclosed)
- [2.3.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.1+is%3Aclosed)
- [2.3.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.3.0+is%3Aclosed)
- [2.2.14](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.14+is%3Aclosed)
- [2.2.13](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.13+is%3Aclosed)
- [2.2.12](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.12+is%3Aclosed)
- [2.2.11](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.11+is%3Aclosed)
- [2.2.10](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.10+is%3Aclosed)
- [2.2.9](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.9+is%3Aclosed)
- [2.2.8](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.8+is%3Aclosed)
- [2.2.7](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.7+is%3Aclosed)
- [2.2.6](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.6+is%3Aclosed)
- [2.2.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.5+is%3Aclosed)
- [2.2.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.4+is%3Aclosed)
- [2.2.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.3+is%3Aclosed)
- [2.2.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.2+is%3Aclosed)
- [2.2.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.1+is%3Aclosed)
- [2.2.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.2.0+is%3Aclosed)
- [2.1.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.1.1+is%3Aclosed)
- [2.1.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.1.0+is%3Aclosed)
- [2.0.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.0.5+is%3Aclosed)
- [2.0.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.0.4+is%3Aclosed)
- [2.0.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.0.3+is%3Aclosed)
- [2.0.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.0.2+is%3Aclosed)
- [2.0.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.0.1+is%3Aclosed)
- [2.0.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.0.0+is%3Aclosed)






## Release instructions

 1. Update the `VERSION` environment variable, e.g. `export VERSION=1.2.3`
 1. Confirm JS files pass linting: `gulp lint`
 1. Confirm all tests passing: `gulp test`
 1. Test the docs and demos with the latest code: `gulp docspub`
 1. Build and publish the release: `gulp publish`



## Tests

Mocha tests are found in the [test directory](https://github.com/cytoscape/cytoscape.js/tree/master/test).  The tests can be run in the browser or they can be run via Node.js (`gulp test` or `mocha`).




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
