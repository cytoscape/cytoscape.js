## Factsheet

* A fully featured graph library written in pure JS
* Permissive open source license (MIT) for the core Cytoscape.js library and all first-party extensions
* Used in commercial projects and open-source projects in production
* Designed for users first, for both frontfacing app usecases *and* developer usecases
* Highly optimised
* No external dependencies
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
* [Fujitsu](https://www.fujitsu.com)
* [GitHub](https://github.com)
* [Google](https://google.com)
* [Hewlett Packard Enterprise](https://www.hpe.com)
* [IBM](https://www.ibm.com)
* [Linux Foundation](https://www.linuxfoundation.org)
* [Meta](https://meta.com) 
* [Microsoft](https://microsoft.com)
* [MongoDB](https://www.mongodb.com)
* [Puppet](https://puppet.com)
* [RedHat](https://www.redhat.com)
* [Tencent](https://www.tencent.com/en-us/)
* [Uber](https://uber.com)

### Government

* [DARPA](http://www.darpa.mil)
* [GCHQ](https://www.gchq.gov.uk/)
* [NHS](https://www.nhs.uk)
* [NOAA](https://www.noaa.gov)
* [NSA](https://www.nsa.gov/)

### Research resources

* [APID](http://cicblade.dep.usal.es:8080/APID/init.action)
* [AraQTL](https://www.bioinformatics.nl/AraQTL/)
* [Arches](https://www.archesproject.org)
* [BioCyc](http://biocyc.org/)
* [BioGRID](http://thebiogrid.org/)
* [BioPlex](https://bioplex.hms.harvard.edu/)
* [cBioPortal](https://www.cbioportal.org)
* [ConsensusPathDB](http://cpdb.molgen.mpg.de/)
* [dSysMap](https://dsysmap.irbbarcelona.org)
* [Elsevier](https://www.elsevier.com)
* [Ensembl](https://www.ensembl.org)
* [FlyBase](https://flybase.org/)
* [Galaxy](https://galaxyproject.org)
* [GeneMANIA](http://genemania.org)
* [GraphSpace](http://graphspace.org)
* [Intermine](http://intermine.org/)
* [MetagenomeScope](https://marbl.github.io/MetagenomeScope/)
* [NDEx](http://www.ndexbio.org/)
* [Newt](https://newteditor.org/)
* [OpenBio](https://www.openbio.eu)
* [Pathway Commons](http://www.pathwaycommons.org)
* [PINet](http://pinet.tsl.ac.uk)
* [Plotly (Dash)](https://plotly.com)
* [QuantStack (Jupyter)](https://quantstack.net)
* [STOCKS](https://gbcs.embl.de/portal/tiki-index.php?page=STOCKS)
* [SynBioHub](https://synbiohub.org)
* [The Gene Ontology Consortium](http://geneontology.org)
* [WormBase](https://wormbase.org/)

### Research & non-profits

* [Aalto University](https://www.aalto.fi/)
* [Albert Ludwig University of Freiburg](https://uni-freiburg.de/en/)
* [Barcelona Supercomputing Center](https://www.bsc.es)
* [BBC](https://www.bbc.com)
* [Ben-Gurion University of the Negev](http://bgu.ac.il/)
* [Berkeley Lab](https://www.lbl.gov)
* [Broad Institute](https://www.broadinstitute.org)
* [Carnegie Mellon](https://www.cmu.edu)
* [Earlham Institute](https://www.earlham.ac.uk)
* [École Polytechnique Fédérale de Lausanne (EPFL)](https://www.epfl.ch)
* [Erasmus Medical Center](https://www.erasmusmc.nl/)
* [European Molecular Biology Laboratory (EMBL)](https://www.embl.org/)
* [FAIRplus](https://fairplus-project.eu)
* [Georgia Institute of Technology](https://www.gatech.edu)
* [Getty](https://www.getty.edu)
* [Harvard University](https://www.harvard.edu)
* [HOPR](https://hoprnet.org)
* [Howard Hughes Medical Institute](https://www.hhmi.org/)
* [Idaho National Laboratory](https://inl.gov)
* [Indiana University](https://www.iu.edu)
* [INRAe](https://www.inrae.fr)
* [Institut Curie](https://institut-curie.org)
* [Institute for Systems Biology](https://isbscience.org)
* [International Rice Research Institute](https://www.irri.org)
* [Johns Hopkins University](https://www.jhu.edu)
* [Lerner Research Institute, Cleveland Clinic](https://www.lerner.ccf.org)
* [Maastricht University](https://www.maastrichtuniversity.nl)
* [Max Plank Institute](https://mpg.de)
* [Nanyang Technological University](https://www.ntu.edu.sg)
* [Network of European Bioimage Analysts](http://eubias.org/NEUBIAS)
* [NHS](https://www.nhs.uk)
* [Norwich Research Park](https://www.norwichresearchpark.com)
* [Observational Health Data Sciences and Informatics (OHDSI)](http://www.ohdsi.org/)
* [Open Ownership](https://www.openownership.org/)
* [Oregon Health and Science University](https://www.ohsu.edu)
* [Paris Sciences et Lettres University](https://psl.eu/en)
* [Penn State University](https://www.psu.edu)
* [Research Institute for Fragrance Materials](https://www.rifm.org)
* [Sanger Institute](http://www.sanger.ac.uk/)
* [Spanish National Bioinformatics Institute](https://inb-elixir.es/)
* [SRI International](https://www.sri.com)
* [Stanford University](https://www.stanford.edu)
* [The Foundation for Research and Technology – Hellas](https://www.forth.gr)
* [The Molecular Science Software Institute](http://molssi.org/)
* [Tsinghua University](https://www.tsinghua.edu.cn)
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
* [University of Helsinki](https://www.helsinki.fi)
* [University of Jyväskylä](https://www.jyu.fi)
* [University of Leipzig](http://uni-leipzig.de)
* [University of Maryland](https://umd.edu/)
* [University of Toronto](https://utoronto.ca)
* [University of Utah](https://www.utah.edu)
* [Vanderbilt University](https://www.vanderbilt.edu)
* [Virginia Tech](http://www.vt.edu)
* [Wageningen University and Research](https://www.wur.nl)
* [World Monuments Fund](https://www.wmf.org)

### Libraries

* [Mermaid](https://mermaid.js.org)

### Apps & services

* [Apache AGE](https://age.apache.org)
* [AppZen](https://www.appzen.com/)
* [Apromore](https://apromore.com)
* [Aras](https://www.aras.com/en)
* [Athenz](https://www.athenz.io)
* [AWS Perspective](https://github.com/awslabs/aws-perspective)
* [Azure Bicep](https://docs.microsoft.com/en-us/azure/azure-resource-manager/bicep/overview)
* [Bell Media](https://www.bellmedia.ca/)
* [BlueSailCRM](https://www.bluesailcrm.com)
* [Budō Lineage Tree, The](https://budotree.judoc.org)
* [BugBug](https://bugbug.io)
* [Cadence](https://cadenceworkflow.io)
* [CanSyL](https://crossbar.kansil.org)
* [Chaos Mesh](https://chaos-mesh.org)
* [Classcraft](https://www.classcraft.com)
* [CompanyTracker](https://www.companytracker.be)
* [CyberSift](https://www.cybersift.io)
* [Cylc](https://cylc.github.io)
* [Dendron](https://www.dendron.so)
* [DGB Technologies](https://www.dgbtek.com)
* [Dockflow](https://dockflow.com)
* [DroneDeploy](https://www.dronedeploy.com)
* [DynaLearn](https://dynalearn.nl)
* [Flowchart.fun](https://flowchart.fun/)
* [Foxglove](https://foxglove.dev)
* [Ganister](https://www.ganister.eu)
* [Global CTO Forum](https://globalctoforum.org)
* [Graphlytic](https://graphlytic.biz)
* [GraphWalker](http://graphwalker.github.io)
* [GREZI](https://grezi.fr)
* [HackerTarget](https://hackertarget.com)
* [HanziGraph](https://hanzigraph.com/)
* [How-4](https://www.how-4.com)
* [ICSI Haystack Panopticon, The](https://haystack.mobi/panopticon/)
* [InfoTrack](https://www.infotrack.com.au)
* [Intercax](https://intercax.com)
* [InterpretML](https://interpret.ml)
* [IPFS](https://ipfs.io) & [libp2p](https://libp2p.io/)
* [Jiva.ai](https://www.jiva.ai)
* [JsDelivr](https://www.jsdelivr.com)
* [Juggl](https://juggl.io)
* [Kanji Map, The](https://thekanjimap.com)
* [Kausal Paths](https://kausal.tech)
* [Kiali](https://kiali.io)
* [Kibana](https://www.elastic.co/kibana)
* [KPN](https://www.kpn.com)
* [KuKaKo](https://github.com/OSC-JYU/KuKaKo)
* [Layer5](https://layer5.io)
* [LearnAwesome](https://learnawesome.org)
* [Machine2Learn](https://machine2learn.com)
* [Manifold Finance](https://www.manifoldfinance.com)
* [Mars](https://docs.pymars.org/en/latest/)
* [Meshery](https://meshery.io)
* [Musicalized](https://en.wesound.academy)
* [Network Weathermap](https://github.com/6illes/weathermap)
* [New Relic](https://newrelic.com)
* [nFlows](https://www.nflows.com)
* [Nx](https://nx.dev)
* [Obsidian](https://obsidian.md)
* [Onepanel](https://www.onepanel.ai)
* [OpenDialog](https://opendialog.ai)
* [Panaya](https://www.panaya.com)
* [Pinpoint](https://pinpoint-apm.gitbook.io/pinpoint/)
* [RecallGraph](https://recallgraph.tech)
* [Roam](https://roamresearch.com)
* [Signifyd](https://www.signifyd.com)
* [SQL Frames](https://sqlframes.com)
* [Steemit](https://steemit.com)
* [stixview](https://github.com/traut/stixview)
* [T-Rank](https://trank.no)
* [ThreatConnect](https://threatconnect.com)
* [ThreatCrowd](https://www.threatcrowd.org)
* [Underlay](https://www.underlay.org)
* [VAC](https://vac.dev)
* [wanderer.ai](https://wanderer.ai)
* [Wisecube AI](https://www.wisecube.ai/orpheus/)
* [Zubir Said Knowledge Graph](https://zubirsaid.sg)


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

{{#if major_release}}
<ul> 
    {{#each major_release}}
    <li>
        {{this.version}}
        {{#if minor_release}}
        <ul>
            {{#each minor_release}}
            <li>
                <a target="_blank" href="{{this.link}}">{{this.minor_ver}}</a>
            </li>
            {{/each}}
        </ul>
        {{/if}}
    </li>
    {{/each}}
</ul>
{{/if}}

## Citation

To cite Cytoscape.js in a paper, please cite the Oxford Bioinformatics issue:

*Cytoscape.js: a graph theory library for visualisation and analysis*

Franz M, Lopes CT, Huck G, Dong Y, Sumer O, Bader GD

[Bioinformatics (2016) 32 (2): 309-311 first published online September 28, 2015 doi:10.1093/bioinformatics/btv557](http://bioinformatics.oxfordjournals.org/content/32/2/309) ([PDF](http://bioinformatics.oxfordjournals.org/content/32/2/309.full.pdf))

- [PubMed abstract for the original 2016 article](http://www.ncbi.nlm.nih.gov/pubmed/26415722)
- [PubMed abstract for the 2023 update article](https://pubmed.ncbi.nlm.nih.gov/36645249)




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
