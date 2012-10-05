# cytoscape.js




## Documentation

You can find the documentation on the [project website](http://cytoscape.github.com/cytoscape.js).  This readme is mostly for developers of Cytoscape.js.





## Acknowledgements

Arbor was used in one of Cytoscape Web's included layouts.  We made some
modifications to the library, written by Samizdat Drafting Co., so that it
would work with multiple instances of Cytoscape Web and that it would work
on lesser browsers, like IE.  Information about this library can be found
at the [Arbor website](http://arborjs.org/) and on [GitHub](https://github.com/maxkfranz/arbor) where the original code was forked.





## Adding source files

When adding source (.js) files to the repository, there are several files that should be updated accordingly:

 * `Makefile` : Include the file in the build process so that the concatenated and minified files generated for distribution include the new file.

 * `src/debug/index.html` : Update the `<script>` tag list with the file so that the debug page can continue to be used to visually test the library.

 * `tests/index.html` : Update the list of JavaScript files that the testing framework considers to consistute the library.  Otherwise, the tests will almost certainly fail.




## Build dependencies

You need a number of executables installed on your system to successfully run
`make` to build the project.
	
Their paths are defined in `Makefile`, so you can revise the paths to these
executables and still run `make` successfully.  You should be able to run
`make` without modification on any well configured Unix-like machine, such as
Linux or Mac OS X---Mac needs XCode with command line tools installed to run
`make`.




## Build instructions

Run `make` in the console.  The targets are:

 * `all` : build everything (default)
 * `minify` : build the production minified JS
 * `zip` : minify and make a ZIP file for release
 * `clean` : deletes built files

A note to developers:

For `zip`, make sure to define `VERSION` in `Makefile` if you're making an
actual release ZIP.




## Tests

QUnit tests are found in the [tests directory](https://github.com/cytoscape/cytoscape.js/tree/master/tests).  The tests are automatically
run against different versions of jQuery.




## Funding

Cytoscape.js development is funded by [Genome Canada](http://www.genomecanada.ca), through the
[Ontario Genomics Institute](http://www.ontariogenomics.ca/) (2007-OGI-TD-05).

Funding for [Cytoscape](http://www.cytoscape.org) is provided by a federal grant from the U.S. 
[National Institute of General Medical Sciences (NIGMS)](http://www.nigms.nih.gov)
of the [National Institutes of Health (NIH)](http://www.nih.gov) under award 
number GM070743-01 and the U.S. [National Science Foundation (NSF)](http://www.nsf.gov).

[ISB](http://www.systemsbiology.org) | 
[UCSD](http://www.ucsd.edu) | 
[MSKCC](http://cbio.mskcc.org) | 
[Pasteur](http://www.pasteur.fr) | 
[Agilent](http://www.agilent.com/) | 
[UCSF](http://www.ucsf.edu/) |
[Unilever](http://www.unilever.com) |
[Toronto](http://www.utoronto.ca) |
[NCIBI](http://portal.ncibi.org/gateway/index.html)


