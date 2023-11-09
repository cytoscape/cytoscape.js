/* global $, cy, notify, window, document */

(function(){

  var assign = function( tgt ){
    var args = arguments;

    for( var i = 1; i < args.length; i++ ){
      var obj = args[ i ];

      if( obj == null ){ continue; }

      var keys = Object.keys( obj );

      for( var j = 0; j < keys.length; j++ ){
        var k = keys[j];

        tgt[ k ] = obj[ k ];
      }
    }

    return tgt;
  };

  var tests = {}; // name => setup
  function test(options){
    var option = document.createElement('option');

    option.value = options.name;
    option.innerHTML = options.displayName;

    $("#test-type-select").appendChild( option );

    tests[options.name] = assign({}, {
      setup: function(){},
      teardown: function(){},
      description: ""
    }, options);
  }
  test({
    name: "none",
    displayName: "None",
    description: "Not currently running any test"
  });

  var currentTest;
  for(var i in tests){
    currentTest = tests[i];
    break;
  }

  $('#note').addEventListener('click', function(){
    $('#note').style.display = 'none';
  });

  $("#test-type-select").addEventListener('change', function(){
    currentTest.teardown();

    var name = $("#test-type-select").value;
    currentTest = tests[name];

    notify( currentTest.displayName, currentTest.description );

    currentTest.setup();
  });

  function randomColor(){
    function randCh(){
      return Math.round( Math.random() * 255 );
    }

    return 'rgb(' + randCh() + ', ' + randCh() + ', ' + randCh() + ')';
  }

  test({
    name: 'gal',
    displayName: 'Load GAL-filtered',
    description: 'Load an example network',
    setup: function(){
      cy.elements().remove();

      (
        fetch('./gal.json')
        .then(function(res){
          return res.json();
        }).then(function(eleJsons){
          cy.add(eleJsons);

          cy.layout({ name: 'grid' }).run();

          cy.fit();
        })
      );
    }
  });

  test({
    name: "randomEdgeColors",
    displayName: "Random edge colours",
    description: "Set each edge to a random colour",
    setup: function(){
      cy.edges().each(function( ele ){
        ele.css( 'line-color', randomColor() );
      });
    },
    teardown: function(){
      cy.edges().removeCss();
    }
  });

  test({
    name: "bypassOnClick",
    displayName: "Bypass on click",
    description: "Set nodes to red and edges to orange on click",
    setup: function(){
      cy.elements().bind("click", function(){
        this.css("background-color", "red");

        this.css({
          lineColor: "orange",
          targetArrowColor: "orange",
          sourceArrowColor: "orange"
        });
      });
    },
    teardown: function(){
      cy.elements().unbind("click").css("*", "");
    }
  });

  test({
    name: "shapeOnClick",
    displayName: "Squares on click",
    description: "Set nodes to squares and edge arrows to squares on click",
    setup: function(){
      cy.elements().bind("click", function(){
        this.css({
          shape: "rectangle",
          targetArrowShape: "square",
          sourceArrowShape: "square"
        });
      });
    },
    teardown: function(){
      cy.elements().unbind("click").css("*", "");
    }
  });

  test({
    name: "positionOnClick",
    displayName: "Random position on click",
    description: "Put node to random position on click",
    setup: function(){
      var w = cy.width();
      var h = cy.height();

      cy.nodes().bind("click", function(){
        var node = this;
        var padding = 50;

        var p2 = {
          x: Math.random() * (w - padding) + padding,
          y: Math.random() * (h - padding) + padding
        };

        node.animate({
          position: p2
        },
        {
          duration: 1000
        });
      });
    },
    teardown: function(){
      cy.elements().unbind("click");
    }
  });


  test({
    name: "labelOnClick",
    displayName: "Label on click",
    description: "Change label on click",
    setup: function(){
      cy.elements().bind("click", function(){
        this.css({
          content: "clicked"
        });
      });
    },
    teardown: function(){
      cy.elements().unbind("click").css("*", "");
    }
  });


  test({
    name: "labelWithWeight",
    displayName: "Labels with weight",
    description: "Show weight in element labels",
    setup: function(){
      cy.style()
        .selector('*')
          .css({
            'content': 'data(weight)'
          })

        .update()
      ;
    },

    teardown: function(){
      var stylesheet = window.defaultSty;

      cy.style( stylesheet );
    }
  });


  test({
    name: "hideOnClick",
    displayName: "visibility:hidden on click",
    description: "visibility:hidden on nodes and edges when clicked",
    setup: function(){
      cy.elements().bind("click", function(){
        this.style('visibility', 'hidden');
      });
    },
    teardown: function(){
      cy.elements().unbind("click").css("*", "");
    }
  });

  test({
    name: "hideOnClick2",
    displayName: "display:none on click",
    description: "display:none on nodes and edges when clicked",
    setup: function(){
      cy.elements().bind("click", function(){
        this.css("display", "none");
      });
    },
    teardown: function(){
      cy.elements().unbind("click").css("*", "");
    }
  });

  test({
    name: "hideOnClick3",
    displayName: "opacity:0 on click",
    description: "opacity:0 on nodes and edges when clicked",
    setup: function(){
      cy.elements().bind("click", function(){
        this.css("opacity", 0);
      });
    },
    teardown: function(){
      cy.elements().unbind("click").css("*", "");
    }
  });

  test({
    name: "growOnClick",
    displayName: "Coloured and sized",
    description: "Make nodes grow/shrink and change colour on click",
    setup: function(){
      cy.nodes().bind("click", function(){
        function rch(){
          return Math.round( Math.random() * 255 );
        }

        function rcolor(){
          return "rgb(" + rch() + "," + rch() + "," + rch() + ")";
        }

        function rsize(){
          return 5 + Math.round( Math.random() * 50 );
        }

        var size = rsize();

        this.stop().animate({
          css: {
            backgroundColor: rcolor(),
            height: size,
            width: size
          }
        }, {
          duration: 1000
        });
      });
    },
    teardown: function(){
      cy.elements().unbind("click").removeCss();
    }
  });

  test({
    name: "colourThenGrow",
    displayName: "Orange, delay, grow, reset",
    description: "Click nodes to trigger",
    setup: function(){
      cy.nodes().bind("click", function(){
        var self = this;
        self
          .stop(true)
          .animate({
            css: {
              backgroundColor: "orange"
            }
          },
          {
            duration: 1000
          })
          .delay(1000)
          .animate({
            css: {
              height: 50,
              width: 50
            }
          },
          {
            duration: 1000
          }).delay(1000, function(){
            self.removeCss();
          });
      });

      cy.edges().bind("click", function(){
        this
          .stop(true)
          .animate({
            bypass: {
              lineColor: "orange",
              targetArrowColor: "orange",
              sourceArrowColor: "orange"
            }
          },
          {
            duration: 1000
          })
          .delay(1000)
          .animate({
            css: {
              width: 7
            }
          },
          {
            duration: 1000
          });
      });
    },
    teardown: function(){
      cy.elements().unbind("click").removeCss();
    }
  });

  test({
    name: "redAndGrow",
    displayName: "Blue and grow in parallel",
    description: "Click nodes to trigger",
    setup: function(){
      cy.nodes().bind("click", function(){
        this
          .stop(true)
          .animate({
            css: {
              backgroundColor: "blue"
            }
          },
          {
            duration: 1000
          })
          .animate({
            css: {
              height: 50,
              width: 50
            }
          },
          {
            duration: 1000,
            queue: false
          });
      });
    },
    teardown: function(){
      cy.nodes().unbind("click").removeCss();
    }
  });

  test({
    name: "bigRedOnClick",
    displayName: "Big & red",
    description: "Click background to toggle",
    setup: function(){
      var on = false;

      cy.bind("click", function(){


        if( !on ){
          cy.nodes().stop().animate({
            css: {
              backgroundColor: "red",
              height: 50,
              width: 50
            }
          },
          {
            duration: 2000
          });

          on = true;
        } else {
          cy.nodes().stop().removeCss();
          on = false;
        }

      });
    },
    teardown: function(){
      cy.unbind("click");
      cy.nodes().removeCss();
    }
  });

  test({
    name: "bigRedOnClickE",
    displayName: "Big & red edges",
    description: "Click background to toggle",
    setup: function(){
      var on = false;

      cy.bind("click", function(){


        if( !on ){
          cy.edges().stop().animate({
            css: {
              lineColor: "red",
              targetArrowColor: "red",
              sourceArrowColor: "red",
              width: 10
            }
          },
          {
            duration: 2000
          });

          on = true;
        } else {
          cy.edges().stop().removeCss();
          on = false;
        }

      });
    },
    teardown: function(){
      cy.unbind("click");
      cy.edges().removeCss();
    }
  });

  test({
    name: "fancyStyle",
    displayName: "Set a fancy visual style",
    description: "Change the visual style and make sure it takes effect",
    setup: function(){

      cy.style()
        .resetToDefault()
        .selector("node")
          .css({
            shape: "rectangle",
            backgroundColor: "lightblue",
            borderColor: "black",
            borderWidth: 1,
            width: "mapData(weight, 20, 100, 20, 100)",
            height: 20,
            labelFontWeight: "normal",
            labelFontSize: "0.75em",
            content: "data(weight)",
            textValign: "center",
            textHalign: "center"
          })
        .selector("edge")
          .css({
            lineColor: "mapData(weight, 0, 100, blue, red)",
            targetArrowShape: "triangle"
          })
        .selector("edge:selected")
          .css({
            width: 3
          })
        .selector("node:selected")
          .css({
            borderWidth: 3
          })
        .update()
      ;
    },

    teardown: function(){
      var stylesheet = window.defaultSty;

      cy.style( stylesheet );
    }
  });

  test({
    name: "strStyle",
    displayName: "Set a string stylesheet",
    description: "Change the visual style and make sure it takes effect",
    setup: function(){
      cy.style('node { background-color: blue; }');
    },

    teardown: function(){
      var stylesheet = window.defaultSty;

      cy.style( stylesheet );
    }
  });

  test({
    name: "addStyle",
    displayName: "Add to current stylesheet",
    description: "Add to the visual style and make sure it takes effect",
    setup: function(){
      cy.style()
        .selector('node')
          .css({
            'background-color': 'blue'
          })

        .update()
      ;
    },

    teardown: function(){
      var stylesheet = window.defaultSty;

      cy.style( stylesheet );
    }
  });

  test({
    name: "redTap",
    displayName: "Mouseover nodes to toggle red bypass",
    description: "..",
    setup: function(){
      var on = {}; // id => true | false

      cy.on('mouseover', 'node', function(){
        if( on[ this.id() ] ){
          this.removeCss();
          on[ this.id() ] = false;
        } else {
          this.css('background-color', 'red');
          on[ this.id() ] = true;
        }
      });
    },

    teardown: function(){
      cy.off('mouseover', 'node');
    }
  });

  test({
    name: "multAni",
    displayName: "Multiple simultaneous animations",
    description: "Tap node to start",
    setup: function(){
      cy.on('tap', 'node', function(e){
        var n = e.target;
        var p = n.position();

        var a1 = n.animation({
          style: {
            'background-color': 'cyan'
          },
          position: {
            x: p.x + 100,
            y: p.y + 100
          },
          duration: 1000
        });

        a1.play();

        var a2 = n.animation({
          style: {
            'width': 60,
            'height': 60
          },
          duration: 1000
        });

        a2.play().promise('complete').then(function(){
          return a2.rewind().reverse().play().promise('complete');
        }).then(function(){
          n.removeStyle();
        });
      });
    },

    teardown: function(){
      cy.off('tap', 'node');
    }
  });

  var faded = false;

  test({
    name: "fadeAni",
    displayName: "Animate element opacity",
    description: "Tap background to toggle",
    setup: function(){
      cy.on('tap', function(e){
        if( e.target !== cy ){ return; }

        faded = !faded;

        cy.elements().animate({
          style: {
            'opacity': faded ? 0.5 : 1
          },
          duration: 1000
        });
      });
    },

    teardown: function(){
      cy.off('tap');
      cy.elements().removeStyle();
    }
  });

  test({
    name: "pngblob",
    displayName: "Export big PNG image via promise",
    description: "Tap background to save the file",
    setup: function(){
      cy.on('tap', function(e){
        if( e.target !== cy ){ return; }

        console.time('pngblob');

        var save = function(blob){
          console.timeEnd('pngblob');

          saveAs(blob, 'blob-promise.png');
        };

        var N = 10000;

        cy.png({ output: 'blob-promise', maxWidth: N, maxHeight: N }).then(save);
      });
    },

    teardown: function(){
      cy.off('tap');
    }
  });

  test({
    name: "png64",
    displayName: "Export big PNG image via base64 blob",
    description: "Tap background to save the file",
    setup: function(){
      cy.on('tap', function(e){
        if( e.target !== cy ){ return; }

        console.time('png64');

        var save = function(blob){
          saveAs(blob, 'base64-blob.png');
        };

        var N = 10000;

        var blob = cy.png({ output: 'blob', maxWidth: N, maxHeight: N });

        console.timeEnd('png64');

        save( blob );
      });
    },

    teardown: function(){
      cy.off('tap');
    }
  });

  test({
    name: "randomLayoutAni",
    displayName: "Animate random layout",
    description: "Tap background to run layout",
    setup: function(){
      cy.on('tap', function(e){
        if( e.target !== cy ){ return; }

        cy.layout({
          name: 'random',
          animate: true,
          animationDuration: 1000
        }).run();
      });
    },

    teardown: function(){
      cy.off('tap');
    }
  });

  var de = cy.$('#de');
  var deToggle = false;

  test({
    name: "rmBez",
    displayName: "Remove bundled bezier",
    description: "Tap background to toggle removing edge `de`",
    setup: function(){
      deToggle = false;

      cy.on('tap', function(e){
        if( e.target !== cy ){ return; }

        deToggle = !deToggle;

        if( deToggle ){
          de.remove();
        } else {
          de.restore();
        }
      });
    },
    teardown: function(){
      cy.off('tap');
      de.restore();
    }
  });

  test({
    name: "mvBez",
    displayName: "Move bundled bezier",
    description: "Tap background to toggle moving edge `de` to source `e` target `f`",
    setup: function(){
      deToggle = false;

      cy.on('tap', function(e){
        if( e.target !== cy ){ return; }

        deToggle = !deToggle;

        if( deToggle ){
          de.move({ source: 'e', target: 'f' });
        } else {
          de.move({ source: 'd', target: 'e' });
        }
      });
    },
    teardown: function(){
      cy.off('tap');
      de.move({ source: 'd', target: 'e' });
    }
  });

  test({
    name: "events:no",
    displayName: "events: no",
    description: "Apply events:no style to all nodes. Clicking on nodes should no longer affect the node.",
    
    setup: function(){
      cy.nodes().style(
        { events: 'no' }
      );
    },
    teardown: function(){
      cy.nodes().removeStyle();
    }
  });

  test({
    name: "text-events:yes",
    displayName: "text-events: yes",
    description: "Apply text-events:yes style to all nodes. Clicking on node labels should select the node.",
    
    setup: function(){
      cy.nodes().style(
        { 'text-events': 'yes' }
      );
    },
    teardown: function(){
      cy.nodes().removeStyle();
    }
  });

  test({
    name: "display:none",
    displayName: "display: none",
    description: "Apply display:none or display:element to nodes. Check that edge visibility works as expected.",
    // bug: https://github.com/cytoscape/cytoscape.js/issues/3070

    setup: function(){
      cy.scratch('prevEles', cy.elements().jsons());
      cy.scratch('prevStyle', cy.style().json());
      cy.elements().remove();

      cy.style()
        .resetToDefault()
        .selector('node')
          .style({
            'background-fit': 'cover',
            'background-color': '#8B5050',
            'border-color': '#000',
            'border-width': 3,
            'border-opacity': 0.5
          })
        .selector('edge')
          .style({
            'width': 1,
            'line-color': '#ffaaaa',
            'curve-style': 'bezier',
            'target-arrow-shape': 'vee'
          })
        .selector('#bird').style({ 'background-image': 'https://live.staticflickr.com/7272/7633179468_3e19e45a0c_b.jpg' })
        .selector('#cat').style({ 'background-image': 'https://live.staticflickr.com/1261/1413379559_412a540d29_b.jpg' })
        .selector('#ladybug').style({ 'background-image': 'https://live.staticflickr.com/3063/2751740612_af11fb090b_b.jpg' })
        .selector('#aphid').style({ 'background-image': 'https://live.staticflickr.com/8316/8003798443_32d01257c8_b.jpg' })
        .selector('#buggy').style({ width: 2, "line-color": "#ff0000", });

      cy.add( [
        { group: 'nodes', data: { id: 'root' } },
        { group: 'nodes', data: { id: 'cat', parent: 'root' } },
        { group: 'nodes', data: { id: 'bird', parent: 'root' } },
        { group: 'nodes', data: { id: 'ladybug', parent: 'root' } },
        { group: 'nodes', data: { id: 'aphid', parent: 'root' } },
        { group: 'edges', data: { source: 'bird', target: 'cat' } },
        { group: 'edges', data: { source: 'aphid', target: 'cat' } },
        { group: 'edges', data: { source: 'bird', target: 'ladybug' } },
        { group: 'edges', data: { source: 'ladybug', target: 'aphid', id: 'buggy' } }
      ] );

      cy.layout({ name: 'grid' }).run();
      cy.fit(cy.elements(), 120);

      const buttonIDs = [];

      cy.nodes().forEach(node=> {
        var id = node.data().id;
        var button = document.createElement('button');
        button.id = 'button_' + id;
        buttonIDs.push(button.id);
        button.innerText = 'hide ' + id;
        button.onclick = () => {
          var display = 'element';
          var text = 'hide';
          if (node.style('display') === 'element') {
            display = 'none';
            text = 'show';
          }
          node.style('display', display);
          button.innerText = text + ' ' +id;
        };
        button.style.position = 'relative';
        document.body.append(button);
      });

      cy.scratch('buttonIDs', buttonIDs);
    },

    teardown: function(){
      const buttonIDs = cy.scratch('buttonIDs');
      buttonIDs.forEach(id => document.getElementById(id).remove());
      cy.removeScratch('buttonIDs');

      cy.elements().remove();
      cy.style().resetToDefault();
      const prevEles = cy.scratch('prevEles');
      const prevStyle = cy.scratch('prevStyle');
      cy.removeScratch('prevEles');
      cy.removeScratch('prevStyle');
      cy.add(prevEles);
      cy.style(prevStyle);
    }
  });
  
})();
