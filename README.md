<img style="width: 200px; height: 200px;" src="https://raw.githubusercontent.com/cytoscape/cytoscape.js/unstable/documentation/img/cytoscape-logo.png" width="200" height="200"></img>

[![GitHub repo](https://img.shields.io/badge/Repo-GitHub-yellow.svg)](https://github.com/cytoscape/cytoscape.js)
[![Ask a question with Phind](https://img.shields.io/badge/Get%20help-Phind-yellow.svg)](https://www.phind.com/search?c=I%27m%20using%20the%20Cytoscape.js%20graph%20theory%20JS%20library.&q=How%20do%20I%20create%20a%20graph%20in%20my%20HTML%20page)
[![News and tutorials](https://img.shields.io/badge/News%20%26%20tutorials-Blog-yellow.svg)](https://blog.js.cytoscape.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://raw.githubusercontent.com/cytoscape/cytoscape.js/master/LICENSE)
[![npm](https://img.shields.io/npm/v/cytoscape.svg)](https://www.npmjs.com/package/cytoscape)
[![DOI](https://zenodo.org/badge/2255947.svg)](https://zenodo.org/badge/latestdoi/2255947)
[![npm installs](https://img.shields.io/npm/dm/cytoscape.svg?label=npm%20installs)](https://www.npmjs.com/package/cytoscape)
[![Automated tests](https://github.com/cytoscape/cytoscape.js/actions/workflows/tests.yml/badge.svg)](https://github.com/cytoscape/cytoscape.js/actions/workflows/tests.yml)
[![Extensions](https://img.shields.io/badge/Extensions-67-brightgreen.svg)](https://js.cytoscape.org/#extensions)


Created at the [University of Toronto](https://utoronto.ca) and published in [Oxford Bioinformatics](https://js.cytoscape.org/#introduction/citation) ([2016](https://academic.oup.com/bioinformatics/article/32/2/309/1744007), [2023](https://academic.oup.com/bioinformatics/article/39/1/btad031/6988031)). <br />
Authored by: [Max Franz](https://github.com/maxkfranz), [Christian Lopes](https://github.com/chrtannus), [Dylan Fong](https://github.com/d2fong), [Mike Kucera](https://github.com/mikekucera), ..., [Gary Bader](https://baderlab.org)

# Cytoscape.js

Graph theory (network) library for visualisation and analysis : [https://js.cytoscape.org](https://js.cytoscape.org)

## Description

Cytoscape.js is a fully featured [graph theory](https://en.wikipedia.org/wiki/Graph_theory) library.  Do you need to model and/or visualise relational data, like biological data or social networks?  If so, Cytoscape.js is just what you need.

Cytoscape.js contains a graph theory model and an optional renderer to display interactive graphs.  This library was designed to make it as easy as possible for programmers and scientists to use graph theory in their apps, whether it's for server-side analysis in a Node.js app or for a rich user interface.

You can get started with Cytoscape.js with one line:

```js
var cy = cytoscape({ elements: myElements, container: myDiv });
```

Learn more about the features of Cytoscape.js by reading [its documentation](https://js.cytoscape.org).


## Example

The Tokyo railway stations network can be visualised with Cytoscape:

<img style="width: 300px; height: 126px;" src="https://raw.githubusercontent.com/cytoscape/cytoscape.js/unstable/documentation/img/tokyo-big.png" width="300" height="126"></img>

<img style="width: 300px; height: 126px;" src="https://raw.githubusercontent.com/cytoscape/cytoscape.js/unstable/documentation/img/tokyo-big-zoomed-in.png" width="300" height="126"></img>

A [live demo](https://js.cytoscape.org/demos/tokyo-railways/) and [source code](https://github.com/cytoscape/cytoscape.js/tree/master/documentation/demos/tokyo-railways) are available for the Tokyo railway stations graph.  More demos are available in the [documentation](https://js.cytoscape.org/#demos).


## Documentation

You can find the documentation and downloads on the [project website](https://js.cytoscape.org).



## Roadmap

Future versions of Cytoscape.js are planned in the [milestones of the Github issue tracker](https://github.com/cytoscape/cytoscape.js/milestones).  You can use the milestones to see what's currently planned for future releases.




## Contributing to Cytoscape.js

Would you like to become a Cytoscape.js contributor?  You can contribute in technical roles (e.g. features, testing) or non-technical roles (e.g. documentation, outreach), depending on your interests.  [Get in touch with us by posting a GitHub discussion](https://github.com/cytoscape/cytoscape.js/discussions).

For the mechanics of contributing a pull request, refer to [CONTRIBUTING.md](CONTRIBUTING.md).

Feature releases are made monthly, while patch releases are made weekly.  This allows for rapid releases of first- and third-party contributions.



## Citation

To cite Cytoscape.js in a paper, please cite the Oxford Bioinformatics issue:

*Cytoscape.js: a graph theory library for visualisation and analysis*

Franz M, Lopes CT, Huck G, Dong Y, Sumer O, Bader GD

[Bioinformatics (2016) 32 (2): 309-311 first published online September 28, 2015 doi:10.1093/bioinformatics/btv557](https://bioinformatics.oxfordjournals.org/content/32/2/309) [(PDF)](http://bioinformatics.oxfordjournals.org/content/32/2/309.full.pdf)

- [PubMed abstract for the original 2016 article](http://www.ncbi.nlm.nih.gov/pubmed/26415722)
- [PubMed abstract for the 2023 update article](https://pubmed.ncbi.nlm.nih.gov/36645249)





## Build dependencies

Install `node` and `npm`.  Run `npm install` before using `npm run`.




## Build instructions

Run `npm run <target>` in the console.  The main targets are:

**Building:**

 * `build`: do all builds of the library (umd, min, umd, esm)
 * `build:min` : do the unminified build with bundled dependencies (for simple html pages, good for novices)
 * `build:umd` : do the umd (cjs/amd/globals) build
 * `build:esm` : do the esm (ES 2015 modules) build
 * `clean` : clean the `build` directory
 * `docs` : build the docs into `documentation`
 * `release` : build all release artifacts
 * `watch` : automatically build lib for debugging (with sourcemap, no babel, very quick)
   * good for general testing on `debug/index.html`
   * served on `http://localhost:8080` or the first available port thereafter, with livereload on `debug/index.html`
 * `watch:babel` : automatically build lib for debugging (with sourcemap, with babel, a bit slower)
   * good for testing performance or for testing out of date browsers
   * served on `http://localhost:8080` or the first available port thereafter, with livereload on `debug/index.html`
 * `watch:umd` : automatically build prod umd bundle (no sourcemap, with babel)
   * good for testing cytoscape in another project (with a `"cytoscape": "file:./path/to/cytoscape"` reference in your project's `package.json`)
   * no http server
 * `dist` : update the distribution js for npm etc.

**Testing:**

The default test scripts run directly against the source code.  Tests can alternatively be run on a built bundle.  The library can be built on `node>=6`, but the library's bundle can be tested on `node>=0.10`.

 * `test` : run all testing & linting
 * `test:js` : run the mocha tests on the public API of the lib (directly on source files)
   * `npm run test:js -- -g "my test name"` runs tests on only the matching test cases
 * `test:build` : run the mocha tests on the public API of the lib (on a built bundle) 
   * `npm run build` should be run beforehand on a recent version of node
   * `npm run test:build -- -g "my test name"` runs build tests on only the matching test cases
 * `test:modules` : run unit tests on private, internal API
   * `npm run test:modules -- -g "my test name"` runs modules tests on only the matching test cases
 * `lint` : lint the js sources via eslint
 * `benchmark` : run all benchmarks
 * `benchmark:single` : run benchmarks only for the suite specified in `benchmark/single`



## Release instructions

 1. Ensure the docs are updated with the list of releases you would like to make in `documentation/md/intro.md` (on both `master` and `unstable` branches).  Push the changes.
 1. Ensure that [milestones](https://github.com/cytoscape/cytoscape.js/milestones) exist for the releases that you would like to make.  Each milestone should contain its corresponding issues and pull requests.
 1. For patch releases, do the back-port patch release before the corresponding current  release.  This ensures that npm lists the current version as the latest one.
     1. `git checkout 1.1.x`, e.g. if the previous feature release is 1.1
     1. Follow the remaining ordinary release steps (step 5 and onward).
 1. Current releases are based on the `master` branch: `git checkout master`
     1. If you are making a patch release, you can just release `master` with its new patches.
     1. If you are making a feature release, you need to merge `unstable` onto `master`.  Since there can be conflicts, it's easiest to use the 'ours' strategy which will allow you to use the state of `unstable` as-is (i.e. no conflict resolution necessary):
         1. Make sure your local `master` is up-to-date: `git checkout master && git pull`
         1. Make sure your local `unstable` is up-to-date: `git checkout unstable && git pull`
         1. Create a merge commit that selects the state of `unstable` and push it: `git merge -s ours master && git push`
         1. Fast-forward `master` to the merge commit: `git checkout master && git merge unstable && git push`
         1. Update the version number in `package.json` and `package-lock.json` on `unstable` to some provisional new version number, and push it.
 1. Update the `VERSION` environment variable for the release number you want to make, e.g. `export VERSION=1.2.3`
 1. Confirm all the tests are passing: 
     1. `npm run test`
     1. See also `test/index.html` for browser testing (optional)
 1. Confirm all the tests are passing in IE9 (for feature releases):
     1. `npm run watch:umd`
     1. Open an [IE9 VM](https://developer.microsoft.com/en-us/microsoft-edge/tools/vms/)
     1. Open `http://yourip:8081/test/ie.html` in IE
 1. Prepare a release: `npm run release`
 1. Review the files that were just built in the previous step.
     1. There should be a series of updated files in the `dist` directory and the `documentation` directory, identified with `git status`.  
     1. Try out the newly-built docs and demos in your browser.
 1. Add the the release to git: `git add . && git commit -m "Build $VERSION"`
 1. Update the package version and tag the release: `npm version $VERSION`
 1. Push the release changes: `git push && git push --tags`
 1. Publish the release to npm: `npm publish`
 1. [Create a release](https://github.com/cytoscape/cytoscape.js/releases/new) for Zenodo from the latest tag.  Make sure you wait at least 5 minutes since the last time that you made a release in order for Zenodo to work properly.
 1. For feature releases:  Create a release announcement on the [blog](https://github.com/cytoscape/cytoscape.js-blog).  Share the announcement on mailing lists and social media.



## Tests

Mocha tests are found in the [test directory](https://github.com/cytoscape/cytoscape.js/tree/master/test).  The tests can be run in the browser or they can be run via Node.js (`npm run test:js`).
