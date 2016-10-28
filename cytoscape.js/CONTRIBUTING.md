# Contributing to Cytoscape.js

Cytoscape.js is an open source project, and we greatly appreciate any and all contributions.

If you'd like to contribute code to Cytoscape.js but you're not sure exactly what you'd like to implement, take a look at our [current milestones](https://github.com/cytoscape/cytoscape.js/milestones) to see what features we have planned in future --- or anything labelled [`help-wanted`](https://github.com/cytoscape/cytoscape.js/issues?q=is%3Aopen+is%3Aissue+label%3Ahelp-wanted).  Of course, we also welcome your own ideas.

Our goal is to make Cytoscape.js as comprehensive as possible.  Thank you for taking the time and effort to contribute to help make that happen!



## Submitting issues

Submit issues or feature requests to the [issue tracker](https://github.com/cytoscape/cytoscape.js/issues).  If your issue pertains to an extension, you should file the issue on that extension's issue tracker instead.

Before submitting an issue, please ensure that the issue still exists in the latest version of the library.  Because we follow semver, you can safely upgrade patch releases (x.y.**z**) and feature releases (x.**y**) without worry of breaking API changes.

Clearly describe your issue.  List the steps necessary to reproduce your issue along with the corresponding code (preferably a JSBin, as that makes the issue less ambiguous and much faster to fix).

Make certain to mention the version of the library you are using and version of the browser/environment you are using.



## Where to put changes

New features go in the `unstable` branch, which is used for the next (breaking/major or feature/minor) version.  Bugfixes go in the `master` branch for the next bugfix/patch version.  This allows us to follow [semver](http://semver.org/) nicely.

The source is organised in relatively the same as the documentation, under `./src`.  Try to maintain that organisation as best you can.  You are free to create new files and `require()` them using the [CommonJS/Node.js](https://nodejs.org/api/modules.html#modules_module_require_id) style.



## Code style

Use two spaces for indentation, and single-quoted strings are preferred.  The main thing is to  try to keep your code neat and similarly formatted as the rest of the code.  There isn't a strict styleguide.

You can run `gulp format` to automatically format the code to more or less match the style we use.  Please do `gulp format` in a separate commit just in case it touches files or lines you didn't change.  Alternatively, you can manually run `jscs --fix <files you changed>`.



## Testing

Tests go in the `./test` directory, as Mocha tests usually do.  They are just a flat list of `.js` files that Mocha runs.  If your change is a bugfix, please add a unit test that would fail without your fix.  If your change is a new feature, please add unit tests accordingly.  If your change is visual/rendering-related, then unit tests are not possible.

Please run `gulp test` or `mocha` to make sure all the unit tests are passing before you make your pull request.
