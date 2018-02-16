## Factsheet

 * A fully featured graph library written in pure JS
 * Permissive open source license (MIT)
 * Designed for users first, for both frontfacing app usecases *and* developer usecases
 * Highly optimised
 * Compatible with
  * All modern browsers (At least ES5 and canvas support are required; feature detection is used for optional performance enhancements)
  * CommonJS/Node.js
  * AMD/Require.js
  * jQuery
  * npm
  * Bower
  * Meteor/Atmosphere
  * The [R language](https://www.r-project.org/) via [RCyjs](http://www.bioconductor.org/packages/release/bioc/html/RCyjs.html)
 * Supports rendering images of graphs on Node.js with [Cytosnap](https://github.com/cytoscape/cytosnap)
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
 * Listed by [Zenodo](https://doi.org/10.5281/zenodo.831800) for per-version DOIs
 * Listed by [OMIC Tools](https://omictools.com/cytoscape-js-tool)
 * Used by
  * [Abasy Atlas](http://abasy.ccg.unam.mx/)
  * [Active Value Advisors](http://www.activevalue.eu/) : [How-4](http://www.how-4.com/)
  * [Agile Protein Interactomes DataServer](http://apid.dep.usal.es/)
  * [Aras](http://www.aras.com/)
  * [Ben-Gurion University of the Negev](http://bgu.ac.il/)
   * [DiffNet](http://netbio.bgu.ac.il/diffnet/)
   * [TissueNet](http://netbio.bgu.ac.il/tissuenet)
  * [BioGRID](http://thebiogrid.org/)
  * [Classcraft](https://www.classcraft.com/)
  * [Cray Inc.](http://www.cray.com)
  * [CyberSift](https://cybersift.io)
  * [CyNetShare](http://cynetshare.ucsd.edu/)
  * [DARPA](http://www.darpa.mil)
  * [dSysMap](http://dsysmap.irbbarcelona.org)
  * [Elsevier](https://www.elsevier.com)
  * [Excel](https://products.office.com/en-us/excel) : [GIGRAPH](https://gigraph.io)
  * [Ganister](http://www.ganister.eu/)
  * [GeneMANIA](http://genemania.org)
  * [Graphlytic](http://graphlytic.sk/)
  * [ICSI Haystack Project](https://haystack.mobi/panopticon/)
  * [InfoTrack](http://www.infotrack.com.au/)
  * [The Interactive Metal Genres Graph](https://www.boundbymetal.com/)
  * [The Kanji Map](http://thekanjimap.com/)
  * [Musicalized](http://en.musicalized.com/full)
  * [NDex](http://www.ndexbio.org/)
  * [OHDSI](http://www.ohdsi.org/)
  * [Pathway Commons](http://www.pathwaycommons.org)
  * [py2cytoscape](https://github.com/idekerlab/py2cytoscape)
  * [Rezza](http://rezza.io)
  * [Sainsbury Laboratory](http://www.tsl.ac.uk/) : [PINet](http://pinet.tsl.ac.uk/)
  * Southwest Harbor Public Library, Maine : [Digital Archive](http://swhplibrary.net/archive/) : [AvantRelationships](https://github.com/gsoules/AvantRelationships)
  * [Sotera Defense Solutions, Inc.](http://www.soteradefense.com/) : [Graphene](http://sotera.github.io/graphene/)
  * [Steemit](https://steemit.com/) : [SteemStars](https://steemstars.herokuapp.com/)
  * [Stringify](https://www.stringify.com/)
  * [Threat Crowd](https://www.threatcrowd.org/)
  * [Trace](https://trace.risingstack.com/)
  * [University of Cambridge](http://www.cam.ac.uk/) : [Intermine](http://intermine.org/)
  * [University of Leipzig, Institute for Medical Informatics, Statistics and Epidemiology (IMISE)](http://www.imise.uni-leipzig.de/en) : [Visualisation of the ontology of Information Management in hospitals](http://www.snik.eu/graph/) for the [SNIK research project](http://www.snik.eu/)
  * [University of Southern California, San Diego](http://www.ucsd.edu/) : [Visualization of structurally related compounds in Mass Spectrometry with Molecular Networks at GNPS](http://gnps.ucsd.edu/ProteoSAFe/result.jsp?view=network_displayer&componentindex=67&task=c95481f0c53d42e78a61bf899e9f9adb#%7B%7D)
  * [VentureApp](https://www.ventureapp.com/) : VentureMap (e.g. [Boston](https://www.ventureapp.com/map/boston-tech/), [New York](https://www.ventureapp.com/map/nyc-tech/), [Chicago](https://www.ventureapp.com/map/chicago-tech/))
  * [Virginia Tech](http://www.vt.edu/index.html) [T. M. Murali's Research Group](http://bioinformatics.cs.vt.edu/~murali/) : [GraphSpace](http://graphspace.org)
  * [Visual Interaction GmbH](http://www.mygaze.com/)
  * [Younivise](http://younivise.com/) : Virtual Advisor



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
 * meteor : `npm install cytoscape`



## Releases

- 3.2
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
