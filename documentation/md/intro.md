## Factsheet

 * A fully featured graph library written in pure JS
 * Permissive open source license (MIT) for the core Cytoscape.js library and all first-party extensions
 * Used in commercial projects and open-source projects in production
 * Designed for users first, for both frontfacing app usecases *and* developer usecases
 * Highly optimised
 * Compatible with
  * All modern browsers
  * Legacy browsers with ES5 and canvas support
    * ES5 and canvas support are required, and feature detection is used for optional performance enhancements.
    * Browsers circa 2012 support ES5 fully: IE10, Chrome 23, Firefox 21, Safari 6 ([caniuse](https://caniuse.com/#feat=es5))
    * Browsers with partial but sufficient ES5 support also work, such as IE9 and Firefox 4.
    * The documentation and examples are not optimised for old browsers, although the library itself is.  Some demos may not work in old browsers in order to keep the demo code simple.
  * Module systems
    * ES modules
    * UMD
      * CommonJS/Node.js
      * Globals
      * AMD/Require.js
  * Package managers
    * npm
    * yarn
    * bower
* Supports the [R language](https://www.r-project.org/) via [RCyjs](http://www.bioconductor.org/packages/release/bioc/html/RCyjs.html)
 * Supports rendering images of graphs on Node.js with [Cytosnap](https://github.com/cytoscape/cytosnap)
 * Has a large suite of tests that can be run in the browser or the terminal
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
 * Well maintained
   * Weekly patch release cadence
   * Monthly feature release cadence
 * Listed by [Zenodo](https://doi.org/10.5281/zenodo.831800) for per-version DOIs
 * Listed by [OMIC Tools](https://omictools.com/cytoscape-js-tool)

## Who uses Cytoscape.js

### Big-name tech

* [Amazon](http://amazon.com)
* [Apache Software Foundation](https://apache.org)
* [Duo](https://duo.com)
* [Elastic](https://www.elastic.co/)
* [Facebook](https://www.facebook.com) 
* [Fujitsu](https://www.fujitsu.com)
* [Google](https://google.com)
* [Hewlett Packard Enterprise](https://www.hpe.com)
* [IBM](https://www.ibm.com)
* [Microsoft](https://microsoft.com)
* [MongoDB](https://www.mongodb.com)
* [Puppet](https://puppet.com)
* [RedHat](https://www.redhat.com)
* [Tencent](https://www.tencent.com/en-us/)
* [Uber](https://uber.com)

### Government

* [DARPA](http://www.darpa.mil)
* [GCHQ](https://www.gchq.gov.uk/)
* [NSA](https://www.nsa.gov/)

### Research resources

* [APID](http://cicblade.dep.usal.es:8080/APID/init.action)
* [AraQTL](https://www.bioinformatics.nl/AraQTL/)
* [BioCyc](http://biocyc.org/)
* [BioGRID](http://thebiogrid.org/)
* [BioPlex](https://bioplex.hms.harvard.edu/)
* [cBioPortal](https://www.cbioportal.org)
* [ConsensusPathDB](http://cpdb.molgen.mpg.de/)
* [dSysMap](https://dsysmap.irbbarcelona.org)
* [Elsevier](https://www.elsevier.com)
* [Ensembl](https://www.ensembl.org)
* [GeneMANIA](http://genemania.org)
* [GraphSpace](http://graphspace.org)
* [Intermine](http://intermine.org/)
* [MetagenomeScope](https://marbl.github.io/MetagenomeScope/)
* [NDEx](http://www.ndexbio.org/)
* [Newt](https://newteditor.org/)
* [Pathway Commons](http://www.pathwaycommons.org)
* [PINet](http://pinet.tsl.ac.uk)
* [Plotly (Dash)](https://plotly.com)
* [QuantStack (Jupyter)](https://quantstack.net)
* [SynBioHub](https://synbiohub.org)
* [The Gene Ontology Consortium](http://geneontology.org)
* [WormBase](https://wormbase.org/)

### Research & non-profits

* [Barcelona Supercomputing Center](https://www.bsc.es)
* [BBC](https://www.bbc.com)
* [Ben-Gurion University of the Negev](http://bgu.ac.il/)
* [Berkeley Lab](https://www.lbl.gov)
* [Broad Institute](https://www.broadinstitute.org)
* [Earlham Institute](https://www.earlham.ac.uk)
* [École Polytechnique Fédérale de Lausanne (EPFL)](https://www.epfl.ch)
* [FAIRplus](https://fairplus-project.eu)
* [Harvard University](https://www.harvard.edu)
* [Howard Hughes Medical Institute](https://www.hhmi.org/)
* [INRAe](https://www.inrae.fr)
* [Institute for Systems Biology](https://isbscience.org)
* [International Rice Research Institute](https://www.irri.org)
* [Max Plank Institute](https://mpg.de)
* [Network of European Bioimage Analysts](http://eubias.org/NEUBIAS)
* [Observational Health Data Sciences and Informatics (OHDSI)](http://www.ohdsi.org/)
* [Research Institute for Fragrance Materials](https://www.rifm.org)
* [Sanger Institute](http://www.sanger.ac.uk/)
* [Spanish National Bioinformatics Institute](https://inb-elixir.es/)
* [SRI International](https://www.sri.com)
* [The Molecular Science Software Institute](http://molssi.org/)
* [UNIST](https://www.unist.ac.kr)
* [Università degli Studi di Milano - Bicocca](https://www.unimib.it)
* [University of Alabama](https://www.ua.edu)
* [University of Barcelona](https://www.ub.edu)
* [University of California, Berkeley](https://www.berkeley.edu)
* [University of California, San Diego](http://www.ucsd.edu)
* [University of California, San Francisco](https://www.ucsf.edu)
* [University of Cambridge](http://www.cam.ac.uk/)
* [University of Electronic Science and Technology of China](http://en.uestc.edu.cn/)
* [University of Heidelberg](https://www.uni-heidelberg.de)
* [University of Leipzig](http://uni-leipzig.de)
* [University of Maryland](https://umd.edu/)
* [University of Utah](https://www.utah.edu)
* [Vanderbilt University](https://www.vanderbilt.edu)
* [Virginia Tech](http://www.vt.edu)
* [Wageningen University and Research](https://www.wur.nl)

### Apps & services

* [AppZen](https://www.appzen.com/)
* [Aras](https://www.aras.com/en)
* [BlueSailCRM](https://www.bluesailcrm.com)
* [BugBug](https://bugbug.io)
* [Classcraft](https://www.classcraft.com)
* [CyberSift](https://www.cybersift.io)
* [Cylc](https://cylc.github.io)
* [Dockflow](https://dockflow.com)
* [DroneDeploy](https://www.dronedeploy.com)
* [DynaLearn](https://dynalearn.nl)
* [Ganister](https://www.ganister.eu)
* [Global CTO Forum](https://globalctoforum.org)
* [Graphlytic](https://graphlytic.biz)
* [GraphWalker](http://graphwalker.github.io)
* [GREZI](https://grezi.fr)
* [HackerTarget](https://hackertarget.com)
* [How-4](https://www.how-4.com)
* [InfoTrack](https://www.infotrack.com.au)
* [Intercax](https://intercax.com)
* [IPFS](https://ipfs.io) & [libp2p](https://libp2p.io/)
* [Jiva.ai](https://www.jiva.ai)
* [JsDelivr](https://www.jsdelivr.com)
* [Juggl](https://juggl.io)
* [Kiali](https://kiali.io)
* [Kibana](https://www.elastic.co/kibana)
* [KPN](https://www.kpn.com)
* [LearnAwesome](https://learnawesome.org)
* [Machine2Learn](https://machine2learn.com)
* [Musicalized](https://en.wesound.academy)
* [New Relic](https://newrelic.com)
* [Obsidian](https://obsidian.md)
* [Onepanel](https://www.onepanel.ai)
* [Panaya](https://www.panaya.com)
* [RecallGraph](https://recallgraph.tech)
* [Roam](https://roamresearch.com)
* [Signifyd](https://www.signifyd.com)
* [Steemit](https://steemit.com)
* [stixview](https://github.com/traut/stixview)
* [The ICSI Haystack Panopticon](https://haystack.mobi/panopticon/)
* [The Kanji Map](https://thekanjimap.com)
* [ThreatCrowd](https://www.threatcrowd.org)
* [Underlay](https://www.underlay.org)
* [VAC](https://vac.dev)
* [wanderer.ai](https://wanderer.ai)
* [Wisecube AI](https://www.wisecube.ai/orpheus/)


### Let us know

[Let us know that you're using Cytoscape.js.](https://github.com/cytoscape/cytoscape.js/issues/914)



## About

Cytoscape.js is an open-source [graph theory](http://en.wikipedia.org/wiki/Graph_theory) (a.k.a. network) library written in JS.  You can use Cytoscape.js for graph analysis and visualisation.

Cytoscape.js allows you to easily display and manipulate rich, interactive graphs.  Because Cytoscape.js allows the user to interact with the graph and the library allows the client to hook into user events, Cytoscape.js is easily integrated into your app, especially since Cytoscape.js supports both desktop browsers, like Chrome, and mobile browsers, like on the iPad.  Cytoscape.js includes all the gestures you would expect out-of-the-box, including pinch-to-zoom, box selection, panning, et cetera.

Cytoscape.js also has graph analysis in mind:  The library contains many useful functions in graph theory.  You can use Cytoscape.js headlessly on Node.js to do graph analysis in the terminal or on a web server.

Cytoscape.js is an open-source project, and anyone is free to contribute.  For more information, refer to the [GitHub README](https://github.com/cytoscape/cytoscape.js).

The library was created at the [Donnelly Centre](http://thedonnellycentre.utoronto.ca) at the [University of Toronto](http://www.utoronto.ca/).  It is the successor of [Cytoscape Web](http://cytoscapeweb.cytoscape.org/).



## Packages

 * npm : `npm install cytoscape`
 * bower : `bower install cytoscape`
 * jspm : `jspm install npm:cytoscape`



## Releases

- 3.19
 - [3.19.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.19.1+is%3Aclosed)
 - [3.19.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.19.0+is%3Aclosed)
- 3.18
 - [3.18.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.18.3+is%3Aclosed)
 - [3.18.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.18.2+is%3Aclosed)
 - [3.18.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.18.1+is%3Aclosed)
 - [3.18.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.18.0+is%3Aclosed)
- 3.17
 - [3.17.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.17.4+is%3Aclosed)
 - [3.17.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.17.3+is%3Aclosed)
 - [3.17.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.17.2+is%3Aclosed)
 - [3.17.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.17.1+is%3Aclosed)
 - [3.17.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.17.0+is%3Aclosed)
- 3.16
 - [3.16.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.16.5+is%3Aclosed)
 - [3.16.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.16.4+is%3Aclosed)
 - [3.16.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.16.3+is%3Aclosed)
 - [3.16.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.16.2+is%3Aclosed)
 - [3.16.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.16.1+is%3Aclosed)
 - [3.16.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.16.0+is%3Aclosed)
- 3.15
 - [3.15.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.15.5+is%3Aclosed)
 - [3.15.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.15.4+is%3Aclosed)
 - [3.15.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.15.3+is%3Aclosed)
 - [3.15.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.15.2+is%3Aclosed)
 - [3.15.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.15.1+is%3Aclosed)
 - [3.15.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.15.0+is%3Aclosed)
- 3.14
 - [3.14.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.14.4+is%3Aclosed)
 - [3.14.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.14.3+is%3Aclosed)
 - [3.14.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.14.2+is%3Aclosed)
 - [3.14.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.14.1+is%3Aclosed)
 - [3.14.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.14.0+is%3Aclosed)
- 3.13
 - [3.13.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.13.3+is%3Aclosed)
 - [3.13.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.13.2+is%3Aclosed)
 - [3.13.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.13.1+is%3Aclosed)
 - [3.13.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.13.0+is%3Aclosed)
- 3.12
 - [3.12.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.12.3+is%3Aclosed)
 - [3.12.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.12.2+is%3Aclosed)
 - [3.12.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.12.1+is%3Aclosed)
 - [3.12.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.12.0+is%3Aclosed)
- 3.11
 - [3.11.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.11.2+is%3Aclosed)
 - [3.11.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.11.1+is%3Aclosed)
 - [3.11.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.11.0+is%3Aclosed)
- 3.10
 - [3.10.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.10.2+is%3Aclosed)
 - [3.10.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.10.1+is%3Aclosed)
 - [3.10.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.10.0+is%3Aclosed)
- 3.9
 - [3.9.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.9.4+is%3Aclosed)
 - [3.9.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.9.3+is%3Aclosed)
 - [3.9.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.9.2+is%3Aclosed)
 - [3.9.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.9.1+is%3Aclosed)
 - [3.9.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.9.0+is%3Aclosed)
- 3.8
 - [3.8.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.8.5+is%3Aclosed)
 - [3.8.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.8.4+is%3Aclosed)
 - [3.8.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.8.3+is%3Aclosed)
 - [3.8.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.8.2+is%3Aclosed)
 - [3.8.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.8.1+is%3Aclosed)
 - [3.8.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.8.0+is%3Aclosed)
- 3.7
 - [3.7.6](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.7.6+is%3Aclosed)
 - [3.7.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.7.5+is%3Aclosed)
 - [3.7.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.7.4+is%3Aclosed)
 - [3.7.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.7.3+is%3Aclosed)
 - [3.7.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.7.2+is%3Aclosed)
 - [3.7.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.7.1+is%3Aclosed)
 - [3.7.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.7.0+is%3Aclosed)
- 3.6
 - [3.6.6](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.6.6+is%3Aclosed)
 - [3.6.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.6.5+is%3Aclosed)
 - [3.6.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.6.4+is%3Aclosed)
 - [3.6.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.6.3+is%3Aclosed)
 - [3.6.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.6.2+is%3Aclosed)
 - [3.6.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.6.1+is%3Aclosed)
 - [3.6.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.6.0+is%3Aclosed)
- 3.5
 - [3.5.9](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.5.9+is%3Aclosed)
 - [3.5.8](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.5.8+is%3Aclosed)
 - [3.5.7](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.5.7+is%3Aclosed)
 - [3.5.6](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.5.6+is%3Aclosed)
 - [3.5.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.5.5+is%3Aclosed)
 - [3.5.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.5.4+is%3Aclosed)
 - [3.5.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.5.3+is%3Aclosed)
 - [3.5.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.5.2+is%3Aclosed)
 - [3.5.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.5.1+is%3Aclosed)
 - [3.5.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.5.0+is%3Aclosed)
- 3.4
 - [3.4.9](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.4.9+is%3Aclosed)
 - [3.4.8](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.4.8+is%3Aclosed)
 - [3.4.7](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.4.7+is%3Aclosed)
 - [3.4.6](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.4.6+is%3Aclosed)
 - [3.4.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.4.5+is%3Aclosed)
 - [3.4.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.4.4+is%3Aclosed)
 - [3.4.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.4.3+is%3Aclosed)
 - [3.4.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.4.2+is%3Aclosed)
 - [3.4.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.4.1+is%3Aclosed)
 - [3.4.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.4.0+is%3Aclosed)
- 3.3
 - [3.3.6](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.3.6+is%3Aclosed)
 - [3.3.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.3.5+is%3Aclosed)
 - [3.3.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.3.4+is%3Aclosed)
 - [3.3.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.3.3+is%3Aclosed)
 - [3.3.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.3.2+is%3Aclosed)
 - [3.3.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.3.1+is%3Aclosed)
 - [3.3.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.3.0+is%3Aclosed)
- 3.2
 - [3.2.22](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.22+is%3Aclosed)
 - [3.2.21](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.21+is%3Aclosed)
 - [3.2.20](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.20+is%3Aclosed)
 - [3.2.19](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.19+is%3Aclosed)
 - [3.2.18](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.18+is%3Aclosed)
 - [3.2.17](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.17+is%3Aclosed)
 - [3.2.16](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.16+is%3Aclosed)
 - [3.2.15](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.15+is%3Aclosed)
 - [3.2.14](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.14+is%3Aclosed)
 - [3.2.13](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.13+is%3Aclosed)
 - [3.2.12](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.12+is%3Aclosed)
 - [3.2.11](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.11+is%3Aclosed)
 - [3.2.10](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.10+is%3Aclosed)
 - [3.2.9](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.9+is%3Aclosed)
 - [3.2.8](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.8+is%3Aclosed)
 - [3.2.7](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.7+is%3Aclosed)
 - [3.2.6](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.6+is%3Aclosed)
 - [3.2.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.5+is%3Aclosed)
 - [3.2.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.4+is%3Aclosed)
 - [3.2.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.3+is%3Aclosed)
 - [3.2.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.2+is%3Aclosed)
 - [3.2.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.1+is%3Aclosed)
 - [3.2.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.2.0+is%3Aclosed)
- 3.1
 - [3.1.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.1.5+is%3Aclosed)
 - [3.1.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.1.4+is%3Aclosed)
 - [3.1.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.1.3+is%3Aclosed)
 - [3.1.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.1.2+is%3Aclosed)
 - [3.1.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.1.1+is%3Aclosed)
 - [3.1.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.1.0+is%3Aclosed)
- 3.0
 - [3.0.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.0.1+is%3Aclosed)
 - [3.0.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A3.0.0+is%3Aclosed)
- 2.7
 - [2.7.29](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.29+is%3Aclosed)
 - [2.7.28](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.28+is%3Aclosed)
 - [2.7.27](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.27+is%3Aclosed)
 - [2.7.26](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.26+is%3Aclosed)
 - [2.7.25](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.25+is%3Aclosed)
 - [2.7.24](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.24+is%3Aclosed)
 - [2.7.23](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.23+is%3Aclosed)
 - [2.7.22](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.22+is%3Aclosed)
 - [2.7.21](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.21+is%3Aclosed)
 - [2.7.20](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.20+is%3Aclosed)
 - [2.7.19](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.19+is%3Aclosed)
 - [2.7.18](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.18+is%3Aclosed)
 - [2.7.17](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.17+is%3Aclosed)
 - [2.7.16](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.16+is%3Aclosed)
 - [2.7.15](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.15+is%3Aclosed)
 - [2.7.14](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.14+is%3Aclosed)
 - [2.7.13](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.13+is%3Aclosed)
 - [2.7.12](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.12+is%3Aclosed)
 - [2.7.11](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.11+is%3Aclosed)
 - [2.7.10](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.10+is%3Aclosed)
 - [2.7.9](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.9+is%3Aclosed)
 - [2.7.8](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.8+is%3Aclosed)
 - [2.7.7](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.7+is%3Aclosed)
 - [2.7.6](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.6+is%3Aclosed)
 - [2.7.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.5+is%3Aclosed)
 - [2.7.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.4+is%3Aclosed)
 - [2.7.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.3+is%3Aclosed)
 - [2.7.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.2+is%3Aclosed)
 - [2.7.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.1+is%3Aclosed)
 - [2.7.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.7.0+is%3Aclosed)
- 2.6
 - [2.6.12](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.6.12+is%3Aclosed)
 - [2.6.11](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.6.11+is%3Aclosed)
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
- 2.5
 - [2.5.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.5.5+is%3Aclosed)
 - [2.5.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.5.4+is%3Aclosed)
 - [2.5.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.5.3+is%3Aclosed)
 - [2.5.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.5.2+is%3Aclosed)
 - [2.5.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.5.1+is%3Aclosed)
 - [2.5.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.5.0+is%3Aclosed)
- 2.4
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
- 2.3
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
- 2.2
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
- 2.1
 - [2.1.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.1.1+is%3Aclosed)
 - [2.1.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.1.0+is%3Aclosed)
- 2.0
 - [2.0.5](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.0.5+is%3Aclosed)
 - [2.0.4](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.0.4+is%3Aclosed)
 - [2.0.3](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.0.3+is%3Aclosed)
 - [2.0.2](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.0.2+is%3Aclosed)
 - [2.0.1](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.0.1+is%3Aclosed)
 - [2.0.0](https://github.com/cytoscape/cytoscape.js/issues?q=milestone%3A2.0.0+is%3Aclosed)



## Citation

To cite Cytoscape.js in a paper, please cite the Oxford Bioinformatics issue:

*Cytoscape.js: a graph theory library for visualisation and analysis*

Franz M, Lopes CT, Huck G, Dong Y, Sumer O, Bader GD

[Bioinformatics (2016) 32 (2): 309-311 first published online September 28, 2015 doi:10.1093/bioinformatics/btv557](http://bioinformatics.oxfordjournals.org/content/32/2/309) ([PDF](http://bioinformatics.oxfordjournals.org/content/32/2/309.full.pdf))

[PubMed abstract](http://www.ncbi.nlm.nih.gov/pubmed/26415722)




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
