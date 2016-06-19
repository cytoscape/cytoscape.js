'use strict';

var util = require( '../util' );
var is = require( '../is' );
var math = require( '../math' );

var styfn = {};

// a caching layer for property parsing
styfn.parse = function( name, value, propIsBypass, propIsFlat ){
  var self = this;

  // function values can't be cached in all cases, and there isn't much benefit of caching them anyway
  if( is.fn( value ) ){
    return self.parseImpl( name, value, propIsBypass, propIsFlat );
  }

  var argHash = [ name, value, propIsBypass, propIsFlat ].join( '$' );
  var propCache = self.propCache = self.propCache || {};
  var ret;

  if( !(ret = propCache[ argHash ]) ){
    ret = propCache[ argHash ] = self.parseImpl( name, value, propIsBypass, propIsFlat );
  }

  // always need a copy since props are mutated later in their lifecycles
  ret = util.copy( ret );

  if( ret ){
    ret.value = util.copy( ret.value ); // because it could be an array, e.g. colour
  }

  return ret;
};

// parse a property; return null on invalid; return parsed property otherwise
// fields :
// - name : the name of the property
// - value : the parsed, native-typed value of the property
// - strValue : a string value that represents the property value in valid css
// - bypass : true iff the property is a bypass property
var parseImpl = function( name, value, propIsBypass, propIsFlat ){
  var self = this;

  name = util.camel2dash( name ); // make sure the property name is in dash form (e.g. 'property-name' not 'propertyName')

  var property = self.properties[ name ];
  var passedValue = value;
  var types = self.types;

  if( !property ){ return null; } // return null on property of unknown name
  if( value === undefined || value === null ){ return null; } // can't assign null

  // the property may be an alias
  if( property.alias ){
    property = property.pointsTo;
    name = property.name;
  }

  var valueIsString = is.string( value );
  if( valueIsString ){ // trim the value to make parsing easier
    value = value.trim();
  }

  var type = property.type;
  if( !type ){ return null; } // no type, no luck

  // check if bypass is null or empty string (i.e. indication to delete bypass property)
  if( propIsBypass && (value === '' || value === null) ){
    return {
      name: name,
      value: value,
      bypass: true,
      deleteBypass: true
    };
  }

  // check if value is a function used as a mapper
  if( is.fn( value ) ){
    return {
      name: name,
      value: value,
      strValue: 'fn',
      mapped: types.fn,
      bypass: propIsBypass
    };
  }

  // check if value is mapped
  var data, mapData, layoutData, mapLayoutData, scratch, mapScratch;
  if( !valueIsString || propIsFlat ){
    // then don't bother to do the expensive regex checks

  } else if(
    ( data = new RegExp( types.data.regex ).exec( value ) ) ||
    ( layoutData = new RegExp( types.layoutData.regex ).exec( value ) ) ||
    ( scratch = new RegExp( types.scratch.regex ).exec( value ) )
  ){
    if( propIsBypass ){ return false; } // mappers not allowed in bypass

    var mapped;
    if( data ){
      mapped = types.data;
    } else if( layoutData ){
      mapped = types.layoutData;
    } else {
      mapped = types.scratch;
    }

    data = data || layoutData || scratch;

    return {
      name: name,
      value: data,
      strValue: '' + value,
      mapped: mapped,
      field: data[1],
      bypass: propIsBypass
    };

  } else if(
    ( mapData = new RegExp( types.mapData.regex ).exec( value ) ) ||
    ( mapLayoutData = new RegExp( types.mapLayoutData.regex ).exec( value ) ) ||
    ( mapScratch = new RegExp( types.mapScratch.regex ).exec( value ) )
  ){
    if( propIsBypass ){ return false; } // mappers not allowed in bypass
    if( type.multiple ){ return false; } // impossible to map to num

    var mapped;
    if( mapData ){
      mapped = types.mapData;
    } else if( mapLayoutData ){
      mapped = types.mapLayoutData;
    } else {
      mapped = types.mapScratch;
    }

    mapData = mapData || mapLayoutData || mapScratch;

    // we can map only if the type is a colour or a number
    if( !(type.color || type.number) ){ return false; }

    var valueMin = this.parse( name, mapData[4] ); // parse to validate
    if( !valueMin || valueMin.mapped ){ return false; } // can't be invalid or mapped

    var valueMax = this.parse( name, mapData[5] ); // parse to validate
    if( !valueMax || valueMax.mapped ){ return false; } // can't be invalid or mapped

    // check if valueMin and valueMax are the same
    if( valueMin.value === valueMax.value ){
      return false; // can't make much of a mapper without a range

    } else if( type.color ){
      var c1 = valueMin.value;
      var c2 = valueMax.value;

      var same = c1[0] === c2[0] // red
        && c1[1] === c2[1] // green
        && c1[2] === c2[2] // blue
        && ( // optional alpha
          c1[3] === c2[3] // same alpha outright
          || (
            (c1[3] == null || c1[3] === 1) // full opacity for colour 1?
            &&
            (c2[3] == null || c2[3] === 1) // full opacity for colour 2?
          )
        )
      ;

      if( same ){ return false; } // can't make a mapper without a range
    }

    return {
      name: name,
      value: mapData,
      strValue: '' + value,
      mapped: mapped,
      field: mapData[1],
      fieldMin: parseFloat( mapData[2] ), // min & max are numeric
      fieldMax: parseFloat( mapData[3] ),
      valueMin: valueMin.value,
      valueMax: valueMax.value,
      bypass: propIsBypass
    };
  }

  if( type.multiple && propIsFlat !== 'multiple' ){
    var vals;

    if( valueIsString ){
      vals = value.split( /\s+/ );
    } else if( is.array( value ) ){
      vals = value;
    } else {
      vals = [ value ];
    }

    if( type.evenMultiple && vals.length % 2 !== 0 ){ return null; }

    var valArr = vals.map( function( v ){
      var p = self.parse( name, v, propIsBypass, 'multiple' );

      if( p.pfValue != null ){
        return p.pfValue;
      } else {
        return p.value;
      }
    } );

    return {
      name: name,
      value: valArr,
      pfValue: valArr,
      strValue: valArr.join( ' ' ),
      bypass: propIsBypass,
      units: type.number && !type.unitless ? type.implicitUnits || 'px' : undefined
    };
  }

  // several types also allow enums
  var checkEnums = function(){
    for( var i = 0; i < type.enums.length; i++ ){
      var en = type.enums[ i ];

      if( en === value ){
        return {
          name: name,
          value: value,
          strValue: '' + value,
          bypass: propIsBypass
        };
      }
    }

    return null;
  };

  // check the type and return the appropriate object
  if( type.number ){
    var units;
    var implicitUnits = 'px'; // not set => px

    if( type.units ){ // use specified units if set
      units = type.units;
    }

    if( type.implicitUnits ){
      implicitUnits = type.implicitUnits;
    }

    if( !type.unitless ){
      if( valueIsString ){
        var unitsRegex = 'px|em' + (type.allowPercent ? '|\\%' : '');
        if( units ){ unitsRegex = units; } // only allow explicit units if so set
        var match = value.match( '^(' + util.regex.number + ')(' + unitsRegex + ')?' + '$' );

        if( match ){
          value = match[1];
          units = match[2] || implicitUnits;
        }

      } else if( !units || type.implicitUnits ){
        units = implicitUnits; // implicitly px if unspecified
      }
    }

    value = parseFloat( value );

    // if not a number and enums not allowed, then the value is invalid
    if( isNaN( value ) && type.enums === undefined ){
      return null;
    }

    // check if this number type also accepts special keywords in place of numbers
    // (i.e. `left`, `auto`, etc)
    if( isNaN( value ) && type.enums !== undefined ){
      value = passedValue;

      return checkEnums();
    }

    // check if value must be an integer
    if( type.integer && !is.integer( value ) ){
      return null;
    }

    // check value is within range
    if( (type.min !== undefined && value < type.min)
    || (type.max !== undefined && value > type.max)
    ){
      return null;
    }

    var ret = {
      name: name,
      value: value,
      strValue: '' + value + (units ? units : ''),
      units: units,
      bypass: propIsBypass
    };

    // normalise value in pixels
    if( type.unitless || (units !== 'px' && units !== 'em') ){
      ret.pfValue = value;
    } else {
      ret.pfValue = ( units === 'px' || !units ? (value) : (this.getEmSizeInPixels() * value) );
    }

    // normalise value in ms
    if( units === 'ms' || units === 's' ){
      ret.pfValue = units === 'ms' ? value : 1000 * value;
    }

    // normalise value in rad
    if( units === 'deg' || units === 'rad' ){
      ret.pfValue = units === 'rad' ? value : math.deg2rad( value );
    }

    return ret;

  } else if( type.propList ){

    var props = [];
    var propsStr = '' + value;

    if( propsStr === 'none' ){
      // leave empty

    } else { // go over each prop

      var propsSplit = propsStr.split( ',' );
      for( var i = 0; i < propsSplit.length; i++ ){
        var propName = propsSplit[ i ].trim();

        if( self.properties[ propName ] ){
          props.push( propName );
        }
      }

      if( props.length === 0 ){ return null; }
    }

    return {
      name: name,
      value: props,
      strValue: props.length === 0 ? 'none' : props.join( ', ' ),
      bypass: propIsBypass
    };

  } else if( type.color ){
    var tuple = util.color2tuple( value );

    if( !tuple ){ return null; }

    return {
      name: name,
      value: tuple,
      strValue: '' + value,
      bypass: propIsBypass,
      roundValue: true
    };

  } else if( type.regex || type.regexes ){

    // first check enums
    if( type.enums ){
      var enumProp = checkEnums();

      if( enumProp ){ return enumProp; }
    }

    var regexes = type.regexes ? type.regexes : [ type.regex ];

    for( var i = 0; i < regexes.length; i++ ){
      var regex = new RegExp( regexes[ i ] ); // make a regex from the type string
      var m = regex.exec( value );

      if( m ){ // regex matches
        return {
          name: name,
          value: m,
          strValue: '' + value,
          bypass: propIsBypass
        };

      }
    }

    return null; // didn't match any

  } else if( type.string ){
    // just return
    return {
      name: name,
      value: value,
      strValue: '' + value,
      bypass: propIsBypass
    };

  } else if( type.enums ){ // check enums last because it's a combo type in others
    return checkEnums();

  } else {
    return null; // not a type we can handle
  }

};
styfn.parseImpl = parseImpl;

module.exports = styfn;
