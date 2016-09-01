'use strict';

var util = require( '../util' );

var styfn = {};

(function(){
  var number = util.regex.number;
  var rgba = util.regex.rgbaNoBackRefs;
  var hsla = util.regex.hslaNoBackRefs;
  var hex3 = util.regex.hex3;
  var hex6 = util.regex.hex6;
  var data = function( prefix ){ return '^' + prefix + '\\s*\\(\\s*([\\w\\.]+)\\s*\\)$'; };
  var mapData = function( prefix ){
    var mapArg = number + '|\\w+|' + rgba + '|' + hsla + '|' + hex3 + '|' + hex6;
    return '^' + prefix + '\\s*\\(([\\w\\.]+)\\s*\\,\\s*(' + number + ')\\s*\\,\\s*(' + number + ')\\s*,\\s*(' + mapArg + ')\\s*\\,\\s*(' + mapArg + ')\\)$';
  };

  // each visual style property has a type and needs to be validated according to it
  styfn.types = {
    time: { number: true, min: 0, units: 's|ms', implicitUnits: 'ms' },
    percent: { number: true, min: 0, max: 100, units: '%', implicitUnits: '%' },
    zeroOneNumber: { number: true, min: 0, max: 1, unitless: true },
    nOneOneNumber: { number: true, min: -1, max: 1, unitless: true },
    nonNegativeInt: { number: true, min: 0, integer: true, unitless: true },
    position: { enums: [ 'parent', 'origin' ] },
    nodeSize: { number: true, min: 0, enums: [ 'label' ] },
    number: { number: true, unitless: true },
    numbers: { number: true, unitless: true, multiple: true },
    size: { number: true, min: 0 },
    bidirectionalSize: { number: true }, // allows negative
    bidirectionalSizes: { number: true, multiple: true }, // allows negative
    bgSize: { number: true, min: 0, allowPercent: true },
    bgWH: { number: true, min: 0, allowPercent: true, enums: [ 'auto' ] },
    bgPos: { number: true, allowPercent: true },
    bgRepeat: { enums: [ 'repeat', 'repeat-x', 'repeat-y', 'no-repeat' ] },
    bgFit: { enums: [ 'none', 'contain', 'cover' ] },
    bgClip: { enums: [ 'none', 'node' ] },
    color: { color: true },
    bool: { enums: [ 'yes', 'no' ] },
    lineStyle: { enums: [ 'solid', 'dotted', 'dashed' ] },
    borderStyle: { enums: [ 'solid', 'dotted', 'dashed', 'double' ] },
    curveStyle: { enums: [ 'bezier', 'unbundled-bezier', 'haystack', 'segments' ] },
    fontFamily: { regex: '^([\\w- \\"]+(?:\\s*,\\s*[\\w- \\"]+)*)$' },
    fontVariant: { enums: [ 'small-caps', 'normal' ] },
    fontStyle: { enums: [ 'italic', 'normal', 'oblique' ] },
    fontWeight: { enums: [ 'normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '800', '900', 100, 200, 300, 400, 500, 600, 700, 800, 900 ] },
    textDecoration: { enums: [ 'none', 'underline', 'overline', 'line-through' ] },
    textTransform: { enums: [ 'none', 'uppercase', 'lowercase' ] },
    textWrap: { enums: [ 'none', 'wrap' ] },
    textBackgroundShape: { enums: [ 'rectangle', 'roundrectangle' ]},
    nodeShape: { enums: [ 'rectangle', 'roundrectangle', 'ellipse', 'triangle', 'square', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'star', 'diamond', 'vee', 'rhomboid', 'polygon' ] },
    compoundIncludeLabels: { enums: [ 'include', 'exclude' ] },
    arrowShape: { enums: [ 'tee', 'triangle', 'triangle-tee', 'triangle-backcurve', 'half-triangle-overshot', 'vee', 'square', 'circle', 'diamond', 'none' ] },
    arrowFill: { enums: [ 'filled', 'hollow' ] },
    display: { enums: [ 'element', 'none' ] },
    visibility: { enums: [ 'hidden', 'visible' ] },
    valign: { enums: [ 'top', 'center', 'bottom' ] },
    halign: { enums: [ 'left', 'center', 'right' ] },
    text: { string: true },
    data: { mapping: true, regex: data( 'data' ) },
    layoutData: { mapping: true, regex: data( 'layoutData' ) },
    scratch: { mapping: true, regex: data( 'scratch' ) },
    mapData: { mapping: true, regex: mapData( 'mapData' ) },
    mapLayoutData: { mapping: true, regex: mapData( 'mapLayoutData' ) },
    mapScratch: { mapping: true, regex: mapData( 'mapScratch' ) },
    fn: { mapping: true, fn: true },
    url: { regex: 'url\\s*\\(\\s*[\'"]?(.+?)[\'"]?\\s*\\)|none|(.+)$' },
    propList: { propList: true },
    angle: { number: true, units: 'deg|rad', implicitUnits: 'rad' },
    textRotation: { number: true, units: 'deg|rad', implicitUnits: 'rad', enums: [ 'none', 'autorotate' ] },
    polygonPointList: { number: true, multiple: true, evenMultiple: true, min: -1, max: 1, unitless: true },
    edgeDistances: { enums: ['intersection', 'node-position'] },
    easing: {
      regexes: [
        '^(spring)\\s*\\(\\s*(' + number + ')\\s*,\\s*(' + number + ')\\s*\\)$',
        '^(cubic-bezier)\\s*\\(\\s*(' + number + ')\\s*,\\s*(' + number + ')\\s*,\\s*(' + number + ')\\s*,\\s*(' + number + ')\\s*\\)$'
      ],
      enums: [
        'linear',
        'ease', 'ease-in', 'ease-out', 'ease-in-out',
        'ease-in-sine', 'ease-out-sine', 'ease-in-out-sine',
        'ease-in-quad', 'ease-out-quad', 'ease-in-out-quad',
        'ease-in-cubic', 'ease-out-cubic', 'ease-in-out-cubic',
        'ease-in-quart', 'ease-out-quart', 'ease-in-out-quart',
        'ease-in-quint', 'ease-out-quint', 'ease-in-out-quint',
        'ease-in-expo', 'ease-out-expo', 'ease-in-out-expo',
        'ease-in-circ', 'ease-out-circ', 'ease-in-out-circ'
      ]
    }
  };

  // define visual style properties
  var t = styfn.types;
  var props = styfn.properties = [
    // main label
    { name: 'label', type: t.text },
    { name: 'text-rotation', type: t.textRotation },
    { name: 'text-margin-x', type: t.bidirectionalSize },
    { name: 'text-margin-y', type: t.bidirectionalSize },

    // source label
    { name: 'source-label', type: t.text },
    { name: 'source-text-rotation', type: t.textRotation },
    { name: 'source-text-margin-x', type: t.bidirectionalSize },
    { name: 'source-text-margin-y', type: t.bidirectionalSize },
    { name: 'source-text-offset', type: t.size },

    // target label
    { name: 'target-label', type: t.text },
    { name: 'target-text-rotation', type: t.textRotation },
    { name: 'target-text-margin-x', type: t.bidirectionalSize },
    { name: 'target-text-margin-y', type: t.bidirectionalSize },
    { name: 'target-text-offset', type: t.size },

    // common label style
    { name: 'text-valign', type: t.valign },
    { name: 'text-halign', type: t.halign },
    { name: 'color', type: t.color },
    { name: 'text-outline-color', type: t.color },
    { name: 'text-outline-width', type: t.size },
    { name: 'text-outline-opacity', type: t.zeroOneNumber },
    { name: 'text-opacity', type: t.zeroOneNumber },
    { name: 'text-background-color', type: t.color },
    { name: 'text-background-margin', type: t.size },
    { name: 'text-background-opacity', type: t.zeroOneNumber },
    { name: 'text-border-opacity', type: t.zeroOneNumber },
    { name: 'text-border-color', type: t.color },
    { name: 'text-border-width', type: t.size },
    { name: 'text-border-style', type: t.borderStyle },
    { name: 'text-background-shape', type: t.textBackgroundShape},
    // { name: 'text-decoration', type: t.textDecoration }, // not supported in canvas
    { name: 'text-transform', type: t.textTransform },
    { name: 'text-wrap', type: t.textWrap },
    { name: 'text-max-width', type: t.size },
    { name: 'text-events', type: t.bool },
    { name: 'font-family', type: t.fontFamily },
    { name: 'font-style', type: t.fontStyle },
    // { name: 'font-variant', type: t.fontVariant }, // not useful
    { name: 'font-weight', type: t.fontWeight },
    { name: 'font-size', type: t.size },
    { name: 'min-zoomed-font-size', type: t.size },

    // behaviour
    { name: 'events', type: t.bool },

    // visibility
    { name: 'display', type: t.display },
    { name: 'visibility', type: t.visibility },
    { name: 'opacity', type: t.zeroOneNumber },
    { name: 'z-index', type: t.nonNegativeInt },

    // overlays
    { name: 'overlay-padding', type: t.size },
    { name: 'overlay-color', type: t.color },
    { name: 'overlay-opacity', type: t.zeroOneNumber },

    // shadows
    { name: 'shadow-blur', type: t.size },
    { name: 'shadow-color', type: t.color },
    { name: 'shadow-opacity', type: t.zeroOneNumber },
    { name: 'shadow-offset-x', type: t.bidirectionalSize },
    { name: 'shadow-offset-y', type: t.bidirectionalSize },

    // label shadows
    { name: 'text-shadow-blur', type: t.size },
    { name: 'text-shadow-color', type: t.color },
    { name: 'text-shadow-opacity', type: t.zeroOneNumber },
    { name: 'text-shadow-offset-x', type: t.bidirectionalSize },
    { name: 'text-shadow-offset-y', type: t.bidirectionalSize },

    // transition anis
    { name: 'transition-property', type: t.propList },
    { name: 'transition-duration', type: t.time },
    { name: 'transition-delay', type: t.time },
    { name: 'transition-timing-function', type: t.easing },

    // node body
    { name: 'height', type: t.nodeSize },
    { name: 'width', type: t.nodeSize },
    { name: 'shape', type: t.nodeShape },
    { name: 'shape-polygon-points', type: t.polygonPointList },
    { name: 'background-color', type: t.color },
    { name: 'background-opacity', type: t.zeroOneNumber },
    { name: 'background-blacken', type: t.nOneOneNumber },
    { name: 'padding-left', type: t.size },
    { name: 'padding-right', type: t.size },
    { name: 'padding-top', type: t.size },
    { name: 'padding-bottom', type: t.size },

    // node border
    { name: 'border-color', type: t.color },
    { name: 'border-opacity', type: t.zeroOneNumber },
    { name: 'border-width', type: t.size },
    { name: 'border-style', type: t.borderStyle },

    // node background images
    { name: 'background-image', type: t.url },
    { name: 'background-image-opacity', type: t.zeroOneNumber },
    { name: 'background-position-x', type: t.bgPos },
    { name: 'background-position-y', type: t.bgPos },
    { name: 'background-repeat', type: t.bgRepeat },
    { name: 'background-fit', type: t.bgFit },
    { name: 'background-clip', type: t.bgClip },
    { name: 'background-width', type: t.bgWH },
    { name: 'background-height', type: t.bgWH },

    // compound props
    { name: 'position', type: t.position },
    { name: 'compound-sizing-wrt-labels', type: t.compoundIncludeLabels },

    // edge line
    { name: 'line-style', type: t.lineStyle },
    { name: 'line-color', type: t.color },
    { name: 'curve-style', type: t.curveStyle },
    { name: 'haystack-radius', type: t.zeroOneNumber },
    { name: 'control-point-step-size', type: t.size },
    { name: 'control-point-distances', type: t.bidirectionalSizes },
    { name: 'control-point-weights', type: t.numbers },
    { name: 'segment-distances', type: t.bidirectionalSizes },
    { name: 'segment-weights', type: t.numbers },
    { name: 'edge-distances', type: t.edgeDistances },

    // these are just for the core
    { name: 'selection-box-color', type: t.color },
    { name: 'selection-box-opacity', type: t.zeroOneNumber },
    { name: 'selection-box-border-color', type: t.color },
    { name: 'selection-box-border-width', type: t.size },
    { name: 'active-bg-color', type: t.color },
    { name: 'active-bg-opacity', type: t.zeroOneNumber },
    { name: 'active-bg-size', type: t.size },
    { name: 'outside-texture-bg-color', type: t.color },
    { name: 'outside-texture-bg-opacity', type: t.zeroOneNumber }
  ];

  // define aliases
  var aliases = styfn.aliases = [
    { name: 'content', pointsTo: 'label' },
    { name: 'control-point-distance', pointsTo: 'control-point-distances' },
    { name: 'control-point-weight', pointsTo: 'control-point-weights' },
    { name: 'edge-text-rotation', pointsTo: 'text-rotation' }
  ];

  // pie backgrounds for nodes
  styfn.pieBackgroundN = 16; // because the pie properties are numbered, give access to a constant N (for renderer use)
  props.push( { name: 'pie-size', type: t.bgSize } );
  for( var i = 1; i <= styfn.pieBackgroundN; i++ ){
    props.push( { name: 'pie-' + i + '-background-color', type: t.color } );
    props.push( { name: 'pie-' + i + '-background-size', type: t.percent } );
    props.push( { name: 'pie-' + i + '-background-opacity', type: t.zeroOneNumber } );
  }

  // edge arrows
  var arrowPrefixes = styfn.arrowPrefixes = [ 'source', 'mid-source', 'target', 'mid-target' ];
  [
    { name: 'arrow-shape', type: t.arrowShape },
    { name: 'arrow-color', type: t.color },
    { name: 'arrow-fill', type: t.arrowFill }
  ].forEach( function( prop ){
    arrowPrefixes.forEach( function( prefix ){
      var name = prefix + '-' + prop.name;
      var type = prop.type;

      props.push( { name: name, type: type } );
    } );
  }, {} );

  // list of property names
  styfn.propertyNames = props.map( function( p ){ return p.name; } );

  // allow access of properties by name ( e.g. style.properties.height )
  for( var i = 0; i < props.length; i++ ){
    var prop = props[ i ];

    props[ prop.name ] = prop; // allow lookup by name
  }

  // map aliases
  for( var i = 0; i < aliases.length; i++ ){
    var alias = aliases[ i ];
    var pointsToProp = props[ alias.pointsTo ];
    var aliasProp = {
      name: alias.name,
      alias: true,
      pointsTo: pointsToProp
    };

    // add alias prop for parsing
    props.push( aliasProp );

    props[ alias.name ] = aliasProp; // allow lookup by name
  }
})();

styfn.getDefaultProperty = function( name ){
  return this.getDefaultProperties()[ name ];
};

styfn.getDefaultProperties = util.memoize( function(){
  var rawProps = util.extend( {
    'events': 'yes',
    'text-events': 'no',
    'text-valign': 'top',
    'text-halign': 'center',
    'color': '#000',
    'text-outline-color': '#000',
    'text-outline-width': 0,
    'text-outline-opacity': 1,
    'text-opacity': 1,
    'text-decoration': 'none',
    'text-transform': 'none',
    'text-wrap': 'none',
    'text-max-width': 9999,
    'text-background-color': '#000',
    'text-background-opacity': 0,
    'text-background-margin': 0,
    'text-border-opacity': 0,
    'text-border-width': 0,
    'text-border-style': 'solid',
    'text-border-color': '#000',
    'text-background-shape': 'rectangle',
    'font-family': 'Helvetica Neue, Helvetica, sans-serif',
    'font-style': 'normal',
    // 'font-variant': fontVariant,
    'font-weight': 'normal',
    'font-size': 16,
    'min-zoomed-font-size': 0,
    'text-rotation': 'none',
    'source-text-rotation': 'none',
    'target-text-rotation': 'none',
    'visibility': 'visible',
    'display': 'element',
    'opacity': 1,
    'z-index': 0,
    'label': '',
    'text-margin-x': 0,
    'text-margin-y': 0,
    'source-label': '',
    'source-text-offset': 0,
    'source-text-margin-x': 0,
    'source-text-margin-y': 0,
    'target-label': '',
    'target-text-offset': 0,
    'target-text-margin-x': 0,
    'target-text-margin-y': 0,
    'overlay-opacity': 0,
    'overlay-color': '#000',
    'overlay-padding': 10,
    'shadow-opacity': 0,
    'shadow-color': '#000',
    'shadow-blur': 10,
    'shadow-offset-x': 0,
    'shadow-offset-y': 0,
    'text-shadow-opacity': 0,
    'text-shadow-color': '#000',
    'text-shadow-blur': 5,
    'text-shadow-offset-x': 0,
    'text-shadow-offset-y': 0,
    'transition-property': 'none',
    'transition-duration': 0,
    'transition-delay': 0,
    'transition-timing-function': 'linear',

    // node props
    'background-blacken': 0,
    'background-color': '#999',
    'background-opacity': 1,
    'background-image': 'none',
    'background-image-opacity': 1,
    'background-position-x': '50%',
    'background-position-y': '50%',
    'background-repeat': 'no-repeat',
    'background-fit': 'none',
    'background-clip': 'node',
    'background-width': 'auto',
    'background-height': 'auto',
    'border-color': '#000',
    'border-opacity': 1,
    'border-width': 0,
    'border-style': 'solid',
    'height': 30,
    'width': 30,
    'shape': 'ellipse',
    'shape-polygon-points': '-1, -1,   1, -1,   1, 1,   -1, 1',

    // compound props
    'padding-top': 0,
    'padding-bottom': 0,
    'padding-left': 0,
    'padding-right': 0,
    'position': 'origin',
    'compound-sizing-wrt-labels': 'include'
  }, {
    // node pie bg
    'pie-size': '100%'
  }, [
    { name: 'pie-{{i}}-background-color', value: 'black' },
    { name: 'pie-{{i}}-background-size', value: '0%' },
    { name: 'pie-{{i}}-background-opacity', value: 1 }
  ].reduce( function( css, prop ){
    for( var i = 1; i <= styfn.pieBackgroundN; i++ ){
      var name = prop.name.replace( '{{i}}', i );
      var val = prop.value;

      css[ name ] = val;
    }

    return css;
  }, {} ), {
    // edge props
    'line-style': 'solid',
    'line-color': '#999',
    'control-point-step-size': 40,
    'control-point-weights': 0.5,
    'segment-weights': 0.5,
    'segment-distances': 20,
    'edge-distances': 'intersection',
    'curve-style': 'bezier',
    'haystack-radius': 0
  }, [
    { name: 'arrow-shape', value: 'none' },
    { name: 'arrow-color', value: '#999' },
    { name: 'arrow-fill', value: 'filled' }
  ].reduce( function( css, prop ){
    styfn.arrowPrefixes.forEach( function( prefix ){
      var name = prefix + '-' + prop.name;
      var val = prop.value;

      css[ name ] = val;
    } );

    return css;
  }, {} ) );

  var parsedProps = {};

  for( var i = 0; i < this.properties.length; i++ ){
    var prop = this.properties[i];

    if( prop.pointsTo ){ continue; }

    var name = prop.name;
    var val = rawProps[ name ];
    var parsedProp = this.parse( name, val );

    parsedProps[ name ] = parsedProp;
  }

  return parsedProps;
} );

styfn.addDefaultStylesheet = function(){
  this
    .selector( '$node > node' ) // compound (parent) node properties
      .css( {
        'shape': 'rectangle',
        'padding-top': 10,
        'padding-right': 10,
        'padding-left': 10,
        'padding-bottom': 10,
        'background-color': '#eee',
        'border-color': '#ccc',
        'border-width': 1
      } )
    .selector( 'edge' ) // just edge properties
      .css( {
        'width': 3,
        'curve-style': 'haystack'
      } )
    .selector( ':selected' )
      .css( {
        'background-color': '#0169D9',
        'line-color': '#0169D9',
        'source-arrow-color': '#0169D9',
        'target-arrow-color': '#0169D9',
        'mid-source-arrow-color': '#0169D9',
        'mid-target-arrow-color': '#0169D9'
      } )
    .selector( 'node:parent:selected' )
      .css( {
        'background-color': '#CCE1F9',
        'border-color': '#aec8e5'
      } )
    .selector( ':active' )
      .css( {
        'overlay-color': 'black',
        'overlay-padding': 10,
        'overlay-opacity': 0.25
      } )
    .selector( 'core' ) // just core properties
      .css( {
        'selection-box-color': '#ddd',
        'selection-box-opacity': 0.65,
        'selection-box-border-color': '#aaa',
        'selection-box-border-width': 1,
        'active-bg-color': 'black',
        'active-bg-opacity': 0.15,
        'active-bg-size': 30,
        'outside-texture-bg-color': '#000',
        'outside-texture-bg-opacity': 0.125
      } )
  ;

  this.defaultLength = this.length;
};

module.exports = styfn;
