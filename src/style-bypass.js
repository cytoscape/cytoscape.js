;(function($$){ 'use strict';

  // bypasses are applied to an existing style on an element, and just tacked on temporarily
  // returns true iff application was successful for at least 1 specified property
  $$.styfn.applyBypass = function( eles, name, value ){
    var props = [];
    
    // put all the properties (can specify one or many) in an array after parsing them
    if( name === "*" || name === "**" ){ // apply to all property names

      if( value !== undefined ){
        for( var i = 0; i < $$.style.properties.length; i++ ){
          var prop = $$.style.properties[i];
          var name = prop.name;

          var parsedProp = this.parse(name, value, true);
          
          if( parsedProp ){
            props.push( parsedProp );
          }
        }
      }

    } else if( $$.is.string(name) ){ // then parse the single property
      var parsedProp = this.parse(name, value, true);

      if( parsedProp ){
        props.push( parsedProp );
      }
    } else if( $$.is.plainObject(name) ){ // then parse each property
      var specifiedProps = name;

      for( var i = 0; i < $$.style.properties.length; i++ ){
        var prop = $$.style.properties[i];
        var name = prop.name;
        var value = specifiedProps[ name ];

        if( value === undefined ){ // try camel case name too
          value = specifiedProps[ $$.util.dash2camel(name) ];
        }

        if( value !== undefined ){
          var parsedProp = this.parse(name, value, true);
          
          if( parsedProp ){
            props.push( parsedProp );
          }
        }
      }
    } else { // can't do anything without well defined properties
      return false;
    }

    // we've failed if there are no valid properties
    if( props.length === 0 ){ return false; }

    // now, apply the bypass properties on the elements
    var ret = false; // return true if at least one succesful bypass applied
    for( var i = 0; i < eles.length; i++ ){ // for each ele
      var ele = eles[i];

      for( var j = 0; j < props.length; j++ ){ // for each prop
        var prop = props[j];

        ret = this.applyParsedProperty( ele, prop ) || ret;
      }
    }

    return ret;
  };

  // only useful in specific cases like animation
  $$.styfn.overrideBypass = function( eles, name, value ){
    for( var i = 0; i < eles.length; i++ ){
      var ele = eles[i];
      var prop = ele._private.style[ $$.util.camel2dash(name) ];

      if( !prop.bypass ){ // need a bypass if one doesn't exist
        this.applyBypass( ele, name, value );
        continue;
      }

      prop.value = value;
      prop.pxValue = value;
    }
  };

  $$.styfn.removeAllBypasses = function( eles ){
    for( var i = 0; i < $$.style.properties.length; i++ ){
      var prop = $$.style.properties[i];
      var name = prop.name;
      var value = ''; // empty => remove bypass

      var parsedProp = this.parse(name, value, true);

      for( var j = 0; j < eles.length; j++ ){
        var ele = eles[j];
        this.applyParsedProperty(ele, parsedProp);
      }
    }
  };

})( cytoscape );