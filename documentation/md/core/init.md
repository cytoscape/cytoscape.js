### Script includes

To use cytoscape.js in your HTML document, you must include the following JS:

  * jQuery 1.4 or newer
	
  * One of
	
    * `cytoscape[.min].js`
		    
      Either the minified or unminified Cytoscape.js code _without any_ dependencies.  When using this file, you must include the appropriate dependencies:  You'll need the dependencies of the SVG renderer.
		    
      SVG renderer dependencies (found in the `lib` directory)
        * `2D.js`
        * `jquery.color.js`
        * `jquery.mousewheel.js`
        * `jquery.svg.js`
		
    * `cytoscape.all[.min].js`
		    
        Either the minified or unminified cytoscape.js code _with all_ dependencies.  When using this file, you do not need to include any of the dependencies for the SVG renderer.

### Getting started

You can initialise cytoscape.js on a HTML element using the traditional jQuery style: 

```js
$("#cy").cytoscape({ // for some div with id 'cy'
  ready: function(cy){
    // you can access the core object API through cy
  },
  ...
});
```

This initialises cytoscape.js and returns back to you your instance of jQuery.  You can continue using jQuery functions, as usual for a jQuery plugin.

For example, 

```js
$("#cy").cytoscape(options)
  .css("background", "red")
  .css("border-color", "black"); // can use jquery functions on 'cy' div 
```

Because this style doesn't give you access to the `cy` object outside of the callback function, there is an option to get the `cy` object from a jQuery selector.

```js
$("#cy").cytoscape(options);
var cy = $("#cy").cytoscape("get"); // now we have a global reference to `cy`
```

Alternatively, you can call functions on the cytoscape.js object associated with a particular HTML element by using the jQuery function call pattern:

```js
// pattern: $("#cy").cytoscape(functionName, param1, param2, param3, ...)
$("#cy").cytoscape("elements", "[weight>20]");
cy.elements("[weight>20]"); // functionally the same as the above line
```




### The ready callback

All of your code that uses the core object API, i.e. through the `cy` object in the examples above, must do so after the `ready` callback function has executed.  You can specify the `ready` callback in the initialisation options, outlined in the following section.

Because the `ready` event may occur before you can bind to the core, you can use this shortcut to spread your code among several JavaScript files without having to call a bunch of global functions in `options.ready`.

```js
// in foo.js
$(function(){ // on jquery ready

  $("#cy").cytoscape(function(eventObject){ // on cytoscape.js ready on the `cy` div
    // this code executes when cytoscape.js is ready even though we
    // don't actually initialise cytoscape.js on the `cy` div until
    // bar.js is loaded

    var cy = this; // `this` holds the reference to the core object
    var alsoCy = eventObject.cy; // you can access the core object also from the event

    console.log("Ready, Freddie!");
  });

});

// in bar.js (should be after foo.js in your js includes)
$(function(){ // on jquery ready
  $("#cy").cytoscape(options);
});
```


### Initialisation options

An instance of cytoscape.js has a number of options that can be set on initialisation.  They are outlined below.

```js
$("#cy").cytoscape({
  layout: { ... },
  renderer: { ... },
  style: { ... },
  ready: function(cy){ ... },
  elements: ...
});
```

**layout** : A [layout options object](ExtensionOptionsObject).  By default, the [grid layout](GridLayout) is used with default options.

**renderer** : A [renderer options object](ExtensionOptionsObject).  By default, the [SVG renderer](SvgRenderer) is used with default options.

**style** : A [visual style object](StyleObject).  The default style of the renderer specified in `renderer` is used by default.

**ready** : A callback function that is called when cytoscape.js is ready to be interacted with.  You can not call functions on the `cy` object before this function executes.

**elements** : A set of [raw elements data object](ElementObject).

### Short alias

cytoscape.js can also be called using a shorter alias, `cy`, for convenience.

For example:

```js
$("#cy").cy(options); // this line is functionally the same as the longer line below
$("#cy").cytoscape(options);

var cy = $("#cy").cy("get"); // these lines are also the same
var cy = $("#cy").cytoscape("get");

$("#cy").cy("nodes", ":selected"); // these lines are also all the same
$("#cy").cytoscape("nodes", ":selected");
$("#cy").cy("get").nodes(":selected");
$("#cy").cytoscape("get").nodes(":selected");
```

It is important to note that if `jQuery.cy` or `jQuery.fn.cy` has already been defined, then cytoscape.js will not allow the use of the short `cy` alias to avoid naming collisions.  So if another jQuery plugin uses the `cy` name, then you have to use the full `cytoscape` name to use cytoscape.js.