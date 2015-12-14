# Contributing to Cytoscape.js

Cytoscape.js is an open source project, and anyone interested is encouraged to contribute to Cytoscape.js.  To contribute, [fork](https://help.github.com/articles/fork-a-repo/) Cytoscape.js, commit your changes, and send a [pull request](https://help.github.com/articles/using-pull-requests/).



## Submitting issues

Submit issues or feature requests to the [issue tracker](https://github.com/cytoscape/cytoscape.js/issues).  If your issue pertains to an extension, you should file the issue on that extension's issue tracker instead.

Before submitting an issue, you should ensure that the issue still exists in the latest version of the library.  Because we follow semver, you can safely upgrade patch releases (x.y.**z**) and feature releases (x.**y**) without worry of breaking API changes.

Clearly describe your issue.  List the steps necessary to reproduce your issue along with the corresponding code (either an inline snippet or a live one like JSBin).

Make certain to mention the version of the library you are using and version of the browser/environment you are using.



## Where to put changes

New features go in the `unstable` branch, which is used for the next (breaking/major or feature/minor) version.  Bugfixes go in the `master` branch for the next bugfix/patch version.  This allows us to follow [semver](http://semver.org/) nicely.

The source is organised in relatively the same as the documentation, under `./src`.  Try to maintain that organisation as best you can.  You are free to create new files and `require()` them using the [CommonJS/Node.js](https://nodejs.org/api/modules.html#modules_module_require_id) style.



## Code style

Use two spaces for indentation, and single-quoted strings are preferred.  The main thing is to  try to keep your code neat and similarly formatted as the rest of the code.  There isn't a strict styleguide.

You can run `gulp format` to automatically format the code to more or less match the style we use.  Please do `gulp format` in a separate commit just in case it touches files or lines you didn't change.  Alternatively, you can manually run `jscs --fix <files you changed>`.



## Testing

Tests go in the `./test` directory, as Mocha tests usually do.  They are just a flat list of `.js` files that Mocha runs.  If your change is a bugfix, please add a unit test that would fail without your fix.  If your change is a new feature, please add unit tests accordingly.  If your change is visual/rendering-related, then unit tests are not possible.

Please run `gulp test` to make sure all the unit tests are passing before you make your pull request.
