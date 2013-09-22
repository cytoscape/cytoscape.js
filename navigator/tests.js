$(function(){

  // set up testing params

  var isIE = navigator.userAgent.indexOf(' MSIE ') > -1;

  if( isIE ){
    window.console = {
      log: function(){},
      group: function(){},
      groupEnd: function(){}
    };
  }

  QUnit.moduleStart = function(module){
    console.group(module.name);
  };

  QUnit.moduleDone = function(){
    console.groupEnd();
  };

  var testCount = 1;
  QUnit.testStart = function(test){
    console.group((testCount++) + ". " + test.name);
  };

  QUnit.testDone = function(){
    console.groupEnd();

    asyncCalls = 0;
  };

  var asyncCalls = 0;
  window.async = function(fn){
    setTimeout(fn, 100 * ++asyncCalls);
  }

  var asyncChecks = 0;
  var asyncExpect = 0;
  var asyncFunction = null;

  window.asyncExpect = function( calls, fn ){
    asyncExpect = calls;
    asyncChecks = 0;
    asyncFunction = fn;
  };

  window.asyncStart = function(){
    asyncChecks++;

    if( asyncChecks >= asyncExpect ){
      if( asyncFunction != null ){
        asyncFunction();
      }
      start();
    }
  };

  var width = 500;
  var height = 500;

  $("#cytoscape").css({
    width: width,
    height: height,
    border: "1px solid #888",
    position: "relative"
  });

  var defaultModule = function(name){
    module(name, {
      setup: function(){
        stop();

        $("#cytoscape").cytoscape({
          elements: {
            nodes: [
                { data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
                { data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
                { data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" }
            ],

            edges: [
                { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
                { data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
            ]
          },
          ready: function(){
            var cy = this;
            window.cy = cy;

            // $(cy.container()).cyNavigator()

            start();
          }
        });

      },

      teardown: function(){}
    });
  }

  defaultModule("Navigator initialisation");
  test("Verify navigator initialisation", function(){
    // Init Navigator
    $(cy.container()).cyNavigator()

    ok($("#cytoscape .cytoscape-navigator").length === 1, "Navigator container found")
    ok($("#cytoscape .cytoscape-navigator canvas").length === 1, "Navigator canvas found")
    ok($("#cytoscape .cytoscape-navigator .cytoscape-navigatorView").length === 1, "Navigator View found")
    ok($("#cytoscape .cytoscape-navigator .cytoscape-navigatorOverlay").length === 1, "Navigator Overlay found")

    // Destroy Navigator
    $(cy.container()).cyNavigator('destroy')
  })


  defaultModule("Navigator zoom");
  test("Verify navigator zoom", function(){
    // Init Navigator
    $(cy.container()).cyNavigator()

    var $view = $("#cytoscape .cytoscape-navigator .cytoscape-navigatorView")

    // At zoom level 1 view width and height should be 266
    ok($view.width() === 266 || $view.width() === 267, "Zoom 1: View width is 266 or 267")
    ok($view.height() === 266 || $view.height() === 267, "Zoom 1: View height is 266 or 267")

    // At zoom level 2 view width and height should be 133
    cy.zoom(2)
    ok($view.width() === 133 || $view.width() === 134, "Zoom 2: View width is 133 or 134")
    ok($view.height() === 133 || $view.height() === 134, "Zoom 2: View height is 133 or 134")

    // At zoom level 10 view width and height should be 26
    cy.zoom(10)
    ok($view.width() === 26 || $view.width() === 27, "Zoom 2: View width is 26 or 27")
    ok($view.height() === 26 || $view.height() === 27, "Zoom 2: View height is 26 or 27")

    // At zoom level 0.5 view width and height should be 533
    cy.zoom(0.5)
    ok($view.width() === 533 || $view.width() === 534, "Zoom 0.5: View width is 533 or 534")
    ok($view.height() === 533 || $view.height() === 534, "Zoom 0.5: View height is 533 or 534")

    // At zoom level 0.1 view width and height should be 0.1
    cy.zoom(0.1)
    ok($view.width() === 2669, "Zoom 0.1: View width is 2669")
    ok($view.height() === 2669, "Zoom 0.1: View height is 2669")

    // Destroy Navigator
    $(cy.container()).cyNavigator('destroy')
  })

  defaultModule("Navigator pan");
  test("Verify navigator pan", function(){
    // Init Navigator
    $(cy.container()).cyNavigator()

    var $view = $("#cytoscape .cytoscape-navigator .cytoscape-navigatorView")

    cy.pan({x: 0, y: 0})
    ok(~~$view.position().top === -58, "Pan 0:0, View's top is right")
    ok(~~$view.position().left === -33, "Pan 0:0, View's left is right")


    cy.pan({x: 100, y: 100})
    ok(~~$view.position().top === -111 || ~~$view.position().top === -112, "Pan 100:100, View's top is right")
    ok(~~$view.position().left === -86 || ~~$view.position().left === -87, "Pan 100:100, View's left is right")

    // Destroy Navigator
    $(cy.container()).cyNavigator('destroy')
  })

  defaultModule("Navigator zoom and pan");
  test("Verify navigator zoom and pan", function(){
    // Init Navigator
    $(cy.container()).cyNavigator()

    var $view = $("#cytoscape .cytoscape-navigator .cytoscape-navigatorView")

    // Reset sizes to be sure
    cy.zoom(1)
    cy.pan({x: 0, y: 0})

    cy.zoom({
      level: 2
    , position: {x: 0, y: 0}
    })
    ok($view.width() == 133 || $view.width() == 134, "Zoom 2, Pan 0:0: View's width is right")
    ok($view.height() == 133 || $view.height() == 134, "Zoom 2, Pan 0:0: View's height is right")
    ok(~~$view.position().top === -58, "Zoom 2, Pan 0:0: View's top is right")
    ok(~~$view.position().left === -33, "Zoom 2, Pan 0:0: View's left is right")

    cy.zoom({
      level: 0.5
    , position: {x: 100, y: 100}
    })
    ok($view.width() == 533 || $view.width() == 534, "Zoom 0.5, Pan 100:100: View's width is right")
    ok($view.height() == 533 || $view.height() == 534, "Zoom 0.5, Pan 100:100: View's height is right")
    ok(~~$view.position().top === -138, "Zoom 0.5, Pan 100:100: View's top is right")
    ok(~~$view.position().left === -113 || ~~$view.position().left === -114, "Zoom 0.5, Pan 100:100: View's left is right")

    cy.fit(cy.elements())
    ok($view.width() == 150, "Fit elements: View's width is right")
    ok($view.height() == 150, "Fit elements: View's height is right")
    ok(~~$view.position().top === 0, "Fit elements: View's top is right")
    ok(~~$view.position().left === 25, "Fit elemets: View's left is right")

    // Destroy Navigator
    $(cy.container()).cyNavigator('destroy')
  })

});
