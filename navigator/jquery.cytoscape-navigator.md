# Cytoscape Navigator

## About the plugin

Navigation Panel is usually a smaller window/panel/block which is a mirror of main window. It has few main purposes:

* Display a bird’s eye view over main window
* Display which part of main window now is visible
* Remote navigation over main window

## Using the plugin

### Initialization

Plugin should be instantiated when graph is loaded. Plugin constructor is cytoscapeNavigator (or cyNavigator).

It can be done: 

* Right after graph is loaded

        $container.cy({
            elements: {}
        }).cy(function(){
            $container.cytoscapeNavigator()
        })
* On ready callback.

        $container.cy({
            elements: {}
            ready: function(){
                $container.cytoscapeNavigator()
            } 
        })
* Anytime when you need it. Do it only after graph was initialised. 

        $button.click(function(){
            $container.cyNavigator()
        })
        
### Customizing plugin

Plugin accepts custom options in form of an object. Full list of available opions is in [Available options](#available-options) section.

    $button.click(function(){
        $container.cyNavigator({
            viewLiveFramerate: 5
        ,   thumbnailEventFramerate: 0
        })
    })
        
### Styling

Navigator and its components (thumbnail's container, view's container) may be styled via css.
It includes background, border, size and position. Default styles can be found in [Navigator css file](https://github.com/bumbu/cytoscape.js/blob/navigator/src/plugins/jquery.cytoscape-navigator.css).

* Ovveride Navigator border and background:

        .cytoscape-navigator{ border: 2px solid red; background: blue; }
* Add border to View container:

        .cytoscape-navigator .cytoscape-navigatorView{ border: 5px solid red; border-radius: 3px; }
* Ovveride overlay container when mouse is over Navigator

        .cytoscape-navigator:hover .cytoscape-navigatorOverlay{ background: yellow; }
* Ovveride view's container when mouse is over view

        .cytoscape-navigator.mouseover-view .cytoscape-navigatorView{ background: rgba(0,255,0,0.5); }

Navigator HTML structure looks like:

    <div class="cytoscape-navigator">
      <canvas></canvas>
      <div class="cytoscape-navigatorView"></div>
      <dib class="cytoscape-navigatorOverlay"></dib>
    </div>
    
### Resize navigator

You may want to reset Navigator's sizes and settings after:

* Resizing graph's container (e.x. `$('#cy').width(900)`)
* Resizing graph's Navigator (e.x. `$('#cy .cytoscape-navigator').width(300)`)

In order to have well looking and functioning Navigator you'll have to do one of the following:

* Trigger _resize_ event on graph container (e.x. `$('#cy').trigger('resize')`)
* Call Navigator's resize method (e.x. `$('#cy').cytoscapeNavigator('resize')`)

## Examples

[Default navigator](http://jsbin.com/EbIT/latest/edit)

[Navigator with custom options and late initialisation](http://jsbin.com/EMELiQI/1/edit)

## Screencast 

[Cytoscape Navigator preview](http://www.youtube.com/watch?v=vGmPK74e8bI)

## Available options

### container 
    container: false
    
Can be a HTML or jQuery element or jQuery selector

Used to indicate navigator HTML container. If is false then a new DOM Element is created.
    
### viewLiveFramerate
    viewLiveFramerate: 0
    
Set false to update graph pan (position) only on navigator's view drag end.
Set 0 to instantly update graph pan when navigator's view is dragged.
Set a positive number (N frames per second) to update navigator's view not more than N times per second.

### thumbnailEventFramerate
    thumbnailEventFramerate: 10
    
Maximal number of thumbnail update's per second triggered by graph events.

### thumbnailLiveFramerate
    thumbnailLiveFramerate: false
    
Maximal number of constant thumbnail update's per second. Set false to disable.

### dblClickDelay
    dblClickDelay: 200
    
Maximal delay (in miliseconds) between two clicks to consider them as a double click.

## Public API

Access plugin methods by calling cyNavigator('function name') from jQuery element graph container:

    $('#cytoscape').cyNavigator('resize') // call resize event to refresh navigator data
    
List of available methods:
* resize
* destroy
