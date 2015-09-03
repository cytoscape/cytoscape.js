;(function($$){ 'use strict';

  $$.style.applyFromJson = function( style, json ){
    for( var i = 0; i < json.length; i++ ){
      var context = json[i];
      var selector = context.selector;
      var props = context.style || context.css;

      style.selector( selector ); // apply selector

      for( var name in props ){
        var value = props[name];

        style.css( name, value ); // apply property
      }
    }

    return style;
  };

  // static function
  $$.style.fromJson = function( cy, json ){
    var style = new $$.Style(cy);

    $$.style.applyFromJson( style, json );

    return style;
  };

  // accessible cy.style() function
  $$.styfn.fromJson = function( json ){
    var style = this;

    style.resetToDefault();

    $$.style.applyFromJson( style, json );

    return style;
  };

  // get json from cy.style() api
  $$.styfn.json = function(){
    var json = [];

    for( var i = this.defaultLength; i < this.length; i++ ){
      var cxt = this[i];
      var selector = cxt.selector;
      var props = cxt.properties;
      var css = {};

      for( var j = 0; j < props.length; j++ ){
        var prop = props[j];
        css[ prop.name ] = prop.strValue;
      }

      json.push({
        selector: !selector ? 'core' : selector.toString(),
        style: css
      });
    }

    return json;
  };

})( cytoscape );
