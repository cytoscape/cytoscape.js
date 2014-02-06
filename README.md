# cytoscape.js




## Documentation

You can find the documentation on the [project website](http://cytoscape.github.com/cytoscape.js), or you may be interested in [downloading the library](http://cytoscape.github.io/cytoscape.js/#downloads).  This readme is mostly for developers of Cytoscape.js.




## Contributing to Cytoscape.js

Cytoscape.js is an open source project, and anyone interested is encouraged to contribute to Cytoscape.js.  We gladly accept pull requests.  If you are interested in regular contributions to Cytoscape.js, then we can arrange granting you permission to the repository by [contacting us](mailto:cytoscape-discuss@googlegroups.com?subject=Granting permission to Cytoscape.js repository).




## Acknowledgements

Arbor was used in one of Cytoscape.js's included layouts.  We made some
modifications to the library, written by Samizdat Drafting Co., so that it
would work with multiple instances of Cytoscape.js and that it would work
on lesser browsers, like IE.  Information about this library can be found
at the [Arbor website](http://arborjs.org/) and on [GitHub](https://github.com/maxkfranz/arbor) where the original code was forked.





## Adding source files

When adding source (.js) files to the repository, there are several files that should be updated accordingly:

 * `Makefile` : Include the file in the build process so that the concatenated and minified files generated for distribution include the new file.

 * `src/debug/index.html` : Update the `<script>` tag list with the file so that the debug page can continue to be used to visually test the library.

 * `test/index.html` : Update the list of JavaScript files that the testing framework considers to consistute the library.  Otherwise, the tests will almost certainly fail when run via HTML.




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
 * `concat` : build the production (non-minified) JS
 * `zip` : minify and make a ZIP file for release
 * `clean` : deletes built files
 * `test` : run the Node.js tests in the terminal and open the tests in the browser
 * `publish` : make a release and publish it; follow the terminal prompts, which contains individually (e.g. in case you'd like to skip something)
  * `test`
  * `version` 
  * `release`
  * `docspublish`
  * `tag`
  * `npm`

A note to developers:

For `zip` and `publish`, make sure to define the `VERSION` environment variable in the terminal if you're making an
actual release ZIP.




## Release instructions

Run `make publish`.  Follow the prompts and a full release should be made for you.



## Tests

Mocha tests are found in the [test directory](https://github.com/cytoscape/cytoscape.js/tree/master/test).  The tests can be run in the browser or they can be run via Node.js (`make test`).




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
[NCIBI](http://portal.ncibi.org/gateway/index.html)


