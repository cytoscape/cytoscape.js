## About plugins

Plugins are reusable UI widgets that can be used with Cytoscape.js in your webapps.  Though Cytoscape.js does not require jQuery as a dependency, it has out-of-the-box compatibility with jQuery, and so it is natural that jQuery plugins be used in this manner.

Thus, a Cytoscape.js plugin is simply a jQuery plugin that is called on Cytoscape.js container and interacts with Cytoscape.js via its API.



## Writing a plugin

Writing a jQuery plugin is a straightforward process, outlined in the [jQuery plugin documentation](http://learn.jquery.com/plugins/).  You can use the `ready` callback to get an instance of Cytoscape.js in your plugin code, assuming that the plugin is called on the Cytoscape.js container:

```js
var $container = $(this); // `this` points to container inside plugin code
$container.cytoscape(function(){
	var cy = this; // now we have a reference to the core
});
```

You can then interact with the instance of Cytoscape.js in your plugin.

The [jQuery Plugin Registry](http://plugins.jquery.com) is where you will make your plugin available.  You will probably want to prefix your plugin's name with "cytoscape" so it is clear that the plugin is for Cytoscape.js, rather than a generic jQuery plugin.  Make sure to tag your plugin with "cytoscape.js" using the `keywords` field in your manifest file.



## Downloads

Cytoscape.js plugins are available on [the jQuery Plugin Registry under the "cytoscape.js" tag](http://plugins.jquery.com/tag/cytoscape.js/).