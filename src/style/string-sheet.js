'use strict';

var util = require( '../util' );
var Selector = require( '../selector' );

var styfn = {};

styfn.applyFromString = function( string ){
  var self = this;
  var style = this;
  var remaining = '' + string;
  var selAndBlockStr;
  var blockRem;
  var propAndValStr;

  // remove comments from the style string
  remaining = remaining.replace( /[/][*](\s|.)+?[*][/]/g, '' );

  function removeSelAndBlockFromRemaining(){
    // remove the parsed selector and block from the remaining text to parse
    if( remaining.length > selAndBlockStr.length ){
      remaining = remaining.substr( selAndBlockStr.length );
    } else {
      remaining = '';
    }
  }

  function removePropAndValFromRem(){
    // remove the parsed property and value from the remaining block text to parse
    if( blockRem.length > propAndValStr.length ){
      blockRem = blockRem.substr( propAndValStr.length );
    } else {
      blockRem = '';
    }
  }

  while( true ){
    var nothingLeftToParse = remaining.match( /^\s*$/ );
    if( nothingLeftToParse ){ break; }

    var selAndBlock = remaining.match( /^\s*((?:.|\s)+?)\s*\{((?:.|\s)+?)\}/ );

    if( !selAndBlock ){
      util.error( 'Halting stylesheet parsing: String stylesheet contains more to parse but no selector and block found in: ' + remaining );
      break;
    }

    selAndBlockStr = selAndBlock[0];

    // parse the selector
    var selectorStr = selAndBlock[1];
    if( selectorStr !== 'core' ){
      var selector = new Selector( selectorStr );
      if( selector._private.invalid ){
        util.error( 'Skipping parsing of block: Invalid selector found in string stylesheet: ' + selectorStr );

        // skip this selector and block
        removeSelAndBlockFromRemaining();
        continue;
      }
    }

    // parse the block of properties and values
    var blockStr = selAndBlock[2];
    var invalidBlock = false;
    blockRem = blockStr;
    var props = [];

    while( true ){
      var nothingLeftToParse = blockRem.match( /^\s*$/ );
      if( nothingLeftToParse ){ break; }

      var propAndVal = blockRem.match( /^\s*(.+?)\s*:\s*(.+?)\s*;/ );

      if( !propAndVal ){
        util.error( 'Skipping parsing of block: Invalid formatting of style property and value definitions found in:' + blockStr );
        invalidBlock = true;
        break;
      }

      propAndValStr = propAndVal[0];
      var propStr = propAndVal[1];
      var valStr = propAndVal[2];

      var prop = self.properties[ propStr ];
      if( !prop ){
        util.error( 'Skipping property: Invalid property name in: ' + propAndValStr );

        // skip this property in the block
        removePropAndValFromRem();
        continue;
      }

      var parsedProp = style.parse( propStr, valStr );

      if( !parsedProp ){
        util.error( 'Skipping property: Invalid property definition in: ' + propAndValStr );

        // skip this property in the block
        removePropAndValFromRem();
        continue;
      }

      props.push( {
        name: propStr,
        val: valStr
      } );
      removePropAndValFromRem();
    }

    if( invalidBlock ){
      removeSelAndBlockFromRemaining();
      break;
    }

    // put the parsed block in the style
    style.selector( selectorStr );
    for( var i = 0; i < props.length; i++ ){
      var prop = props[ i ];
      style.css( prop.name, prop.val );
    }

    removeSelAndBlockFromRemaining();
  }

  return style;
};

styfn.fromString = function( string ){
  var style = this;

  style.resetToDefault();
  style.applyFromString( string );

  return style;
};

module.exports = styfn;
