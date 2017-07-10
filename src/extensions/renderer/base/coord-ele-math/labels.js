var math = require( '../../../../math' );
var is = require( '../../../../is' );
var util = require( '../../../../util' );

var BRp = {};

BRp.recalculateNodeLabelProjection = function( node ){
  var content = node.pstyle( 'label' ).strValue;

  if( is.emptyString(content) ){ return; }

  var textX, textY;
  var _p = node._private;
  var nodeWidth = node.width();
  var nodeHeight = node.height();
  var padding = node.padding();
  var nodePos = node.position();
  var textHalign = node.pstyle( 'text-halign' ).strValue;
  var textValign = node.pstyle( 'text-valign' ).strValue;
  var rs = _p.rscratch;
  var rstyle = _p.rstyle;

  switch( textHalign ){
    case 'left':
      textX = nodePos.x - nodeWidth / 2 - padding;
      break;

    case 'right':
      textX = nodePos.x + nodeWidth / 2 + padding;
      break;

    default: // e.g. center
      textX = nodePos.x;
  }

  switch( textValign ){
    case 'top':
      textY = nodePos.y - nodeHeight / 2 - padding;
      break;

    case 'bottom':
      textY = nodePos.y + nodeHeight / 2 + padding;
      break;

    default: // e.g. middle
      textY = nodePos.y;
  }

  rs.labelX = textX;
  rs.labelY = textY;
  rstyle.labelX = textX;
  rstyle.labelY = textY;

  this.applyLabelDimensions( node );
};

BRp.recalculateEdgeLabelProjections = function( edge ){
  var p;
  var _p = edge._private;
  var rs = _p.rscratch;
  var r = this;
  var content = {
    mid: edge.pstyle('label').strValue,
    source: edge.pstyle('source-label').strValue,
    target: edge.pstyle('target-label').strValue
  };

  if( content.mid || content.source || content.target ){
    // then we have to calculate...
  } else {
    return; // no labels => no calcs
  }

  // add center point to style so bounding box calculations can use it
  //
  p = {
    x: rs.midX,
    y: rs.midY
  };

  var setRs = function( propName, prefix, value ){
    util.setPrefixedProperty( _p.rscratch, propName, prefix, value );
    util.setPrefixedProperty( _p.rstyle, propName, prefix, value );
  };

  setRs( 'labelX', null, p.x );
  setRs( 'labelY', null, p.y );

  var createControlPointInfo = function(){
    if( createControlPointInfo.cache ){ return createControlPointInfo.cache; } // use cache so only 1x per edge

    var ctrlpts = [];

    // store each ctrlpt info init
    for( var i = 0; i + 5 < rs.allpts.length; i += 4 ){
      var p0 = { x: rs.allpts[i], y: rs.allpts[i+1] };
      var p1 = { x: rs.allpts[i+2], y: rs.allpts[i+3] }; // ctrlpt
      var p2 = { x: rs.allpts[i+4], y: rs.allpts[i+5] };

      ctrlpts.push({
        p0: p0,
        p1: p1,
        p2: p2,
        startDist: 0,
        length: 0,
        segments: []
      });
    }

    var bpts = _p.rstyle.bezierPts;
    var nProjs = r.bezierProjPcts.length;

    function addSegment( cp, p0, p1, t0, t1 ){
      var length = math.dist( p0, p1 );
      var prevSegment = cp.segments[ cp.segments.length - 1 ];
      var segment = {
        p0: p0,
        p1: p1,
        t0: t0,
        t1: t1,
        startDist: prevSegment ? prevSegment.startDist + prevSegment.length : 0,
        length: length
      };

      cp.segments.push( segment );

      cp.length += length;
    }

    // update each ctrlpt with segment info
    for( var i = 0; i < ctrlpts.length; i++ ){
      var cp = ctrlpts[i];
      var prevCp = ctrlpts[i - 1];

      if( prevCp ){
        cp.startDist = prevCp.startDist + prevCp.length;
      }

      addSegment(
        cp,
        cp.p0,   bpts[ i * nProjs ],
        0,       r.bezierProjPcts[ 0 ]
      ); // first

      for( var j = 0; j < nProjs - 1; j++ ){
        addSegment(
          cp,
          bpts[ i * nProjs + j ],   bpts[ i * nProjs + j + 1 ],
          r.bezierProjPcts[ j ],    r.bezierProjPcts[ j + 1 ]
        );
      }

      addSegment(
        cp,
        bpts[ i * nProjs + nProjs - 1 ],   cp.p2,
        r.bezierProjPcts[ nProjs - 1 ],    1
      ); // last
    }

    return ( createControlPointInfo.cache = ctrlpts );
  };

  var calculateEndProjection = function( prefix ){
    var angle;
    var isSrc = prefix === 'source';

    if( !content[ prefix ] ){ return; }

    var offset = edge.pstyle(prefix+'-text-offset').pfValue;

    var lineAngle = function( p0, p1 ){
      var dx = p1.x - p0.x;
      var dy = p1.y - p0.y;

      return Math.atan( dy / dx );
    };

    var bezierAngle = function( p0, p1, p2, t ){
      var t0 = math.bound( 0, t - 0.001, 1 );
      var t1 = math.bound( 0, t + 0.001, 1 );

      var lp0 = math.qbezierPtAt( p0, p1, p2, t0 );
      var lp1 = math.qbezierPtAt( p0, p1, p2, t1 );

      return lineAngle( lp0, lp1 );
    };

    switch( rs.edgeType ){
      case 'self':
      case 'compound':
      case 'bezier':
      case 'multibezier':
        var cps = createControlPointInfo();
        var selected;
        var startDist = 0;
        var totalDist = 0;

        // find the segment we're on
        for( var i = 0; i < cps.length; i++ ){
          var cp = cps[ isSrc ? i : cps.length - 1 - i ];

          for( var j = 0; j < cp.segments.length; j++ ){
            var seg = cp.segments[ isSrc ? j : cp.segments.length - 1 - j ];
            var lastSeg = i === cps.length - 1 && j === cp.segments.length - 1;

            startDist = totalDist;
            totalDist += seg.length;

            if( totalDist >= offset || lastSeg ){
              selected = { cp: cp, segment: seg };
              break;
            }
          }

          if( selected ){ break; }
        }

        var cp = selected.cp;
        var seg = selected.segment;
        var tSegment = ( offset - startDist ) / ( seg.length );
        var segDt = seg.t1 - seg.t0;
        var t = isSrc ? seg.t0 + segDt * tSegment : seg.t1 - segDt * tSegment;

        t = math.bound( 0, t, 1 );
        p = math.qbezierPtAt( cp.p0, cp.p1, cp.p2, t );
        angle = bezierAngle( cp.p0, cp.p1, cp.p2, t, p );

        break;

      case 'straight':
      case 'segments':
      case 'haystack':
        var d = 0, di, d0;
        var p0, p1;
        var l = rs.allpts.length;

        for( var i = 0; i + 3 < l; i += 2 ){
          if( isSrc ){
            p0 = { x: rs.allpts[i],     y: rs.allpts[i+1] };
            p1 = { x: rs.allpts[i+2],   y: rs.allpts[i+3] };
          } else {
            p0 = { x: rs.allpts[l-2-i], y: rs.allpts[l-1-i] };
            p1 = { x: rs.allpts[l-4-i], y: rs.allpts[l-3-i] };
          }

          di = math.dist( p0, p1 );
          d0 = d;
          d += di;

          if( d >= offset ){ break; }
        }

        var pD = offset - d0;
        var t = pD / di;

        t  = math.bound( 0, t, 1 );
        p = math.lineAt( p0, p1, t );
        angle = lineAngle( p0, p1 );

        break;
    }

    setRs( 'labelX', prefix, p.x );
    setRs( 'labelY', prefix, p.y );
    setRs( 'labelAutoAngle', prefix, angle );
  };

  calculateEndProjection( 'source' );
  calculateEndProjection( 'target' );

  this.applyLabelDimensions( edge );
};

BRp.applyLabelDimensions = function( ele ){
  this.applyPrefixedLabelDimensions( ele );

  if( ele.isEdge() ){
    this.applyPrefixedLabelDimensions( ele, 'source' );
    this.applyPrefixedLabelDimensions( ele, 'target' );
  }
};

BRp.applyPrefixedLabelDimensions = function( ele, prefix ){
  var _p = ele._private;

  var text = this.getLabelText( ele, prefix );
  var labelDims = this.calculateLabelDimensions( ele, text );

  util.setPrefixedProperty( _p.rstyle,   'labelWidth', prefix, labelDims.width );
  util.setPrefixedProperty( _p.rscratch, 'labelWidth', prefix, labelDims.width );

  util.setPrefixedProperty( _p.rstyle,   'labelHeight', prefix, labelDims.height );
  util.setPrefixedProperty( _p.rscratch, 'labelHeight', prefix, labelDims.height );
};

BRp.getLabelText = function( ele, prefix ){
  var _p = ele._private;
  var pfd = prefix ? prefix + '-' : '';
  var text = ele.pstyle( pfd + 'label' ).strValue;
  var textTransform = ele.pstyle( 'text-transform' ).value;
  var rscratch = function( propName, value ){
    if( value ){
      util.setPrefixedProperty( _p.rscratch, propName, prefix, value );
      return value;
    } else {
      return util.getPrefixedProperty( _p.rscratch, propName, prefix );
    }
  };

  if( textTransform == 'none' ){
    // passthrough
  } else if( textTransform == 'uppercase' ){
    text = text.toUpperCase();
  } else if( textTransform == 'lowercase' ){
    text = text.toLowerCase();
  }

  var wrapStyle = ele.pstyle( 'text-wrap' ).value;

  if( wrapStyle === 'wrap' ){
    //console.log('wrap');

    var labelKey = rscratch( 'labelKey' );

    // save recalc if the label is the same as before
    if( labelKey && rscratch( 'labelWrapKey' ) === labelKey ){
      // console.log('wrap cache hit');
      return rscratch( 'labelWrapCachedText' );
    }
    // console.log('wrap cache miss');

    var lines = text.split( '\n' );
    var maxW = ele.pstyle( 'text-max-width' ).pfValue;
    var wrappedLines = [];

    for( var l = 0; l < lines.length; l++ ){
      var line = lines[ l ];
      var lineDims = this.calculateLabelDimensions( ele, line, 'line=' + line );
      var lineW = lineDims.width;

      if( lineW > maxW ){ // line is too long
        var words = line.split( /\s+/ ); // NB: assume collapsed whitespace into single space
        var subline = '';

        for( var w = 0; w < words.length; w++ ){
          var word = words[ w ];
          var testLine = subline.length === 0 ? word : subline + ' ' + word;
          var testDims = this.calculateLabelDimensions( ele, testLine, 'testLine=' + testLine );
          var testW = testDims.width;

          if( testW <= maxW ){ // word fits on current line
            subline += word + ' ';
          } else { // word starts new line
            wrappedLines.push( subline );
            subline = word + ' ';
          }
        }

        // if there's remaining text, put it in a wrapped line
        if( !subline.match( /^\s+$/ ) ){
          wrappedLines.push( subline );
        }
      } else { // line is already short enough
        wrappedLines.push( line );
      }
    } // for

    rscratch( 'labelWrapCachedLines', wrappedLines );
    text = rscratch( 'labelWrapCachedText', wrappedLines.join( '\n' ) );
    rscratch( 'labelWrapKey', labelKey );

    // console.log(text)
  } else if( wrapStyle === 'ellipsis' ){
    var maxW = ele.pstyle( 'text-max-width' ).pfValue;
    var ellipsized = '';
    var ellipsis = '\u2026';
    var incLastCh = false;

    for( var i = 0; i < text.length; i++ ){
      var widthWithNextCh = this.calculateLabelDimensions( ele, ellipsized + text[i] + ellipsis ).width;

      if( widthWithNextCh > maxW ){ break; }

      ellipsized += text[i];

      if( i === text.length - 1 ){ incLastCh = true; }
    }

    if( !incLastCh ){
      ellipsized += ellipsis;
    }

    return ellipsized;
  } // if ellipsize

  return text;
};

BRp.calculateLabelDimensions = function( ele, text, extraKey ){
  var r = this;

  var cacheKey = ele._private.labelStyleKey + '$@$' + text;

  if( extraKey ){
    cacheKey += '$@$' + extraKey;
  }

  var cache = r.labelDimCache || (r.labelDimCache = {});

  if( cache[ cacheKey ] ){
    return cache[ cacheKey ];
  }

  var sizeMult = 1; // increase the scale to increase accuracy w.r.t. zoomed text
  var fStyle = ele.pstyle( 'font-style' ).strValue;
  var size = ( sizeMult * ele.pstyle( 'font-size' ).pfValue ) + 'px';
  var family = ele.pstyle( 'font-family' ).strValue;
  var weight = ele.pstyle( 'font-weight' ).strValue;

  var div = this.labelCalcDiv;

  if( !div ){
    div = this.labelCalcDiv = document.createElement( 'div' ); // eslint-disable-line no-undef
    document.body.appendChild( div ); // eslint-disable-line no-undef
  }

  var ds = div.style;

  // from ele style
  ds.fontFamily = family;
  ds.fontStyle = fStyle;
  ds.fontSize = size;
  ds.fontWeight = weight;

  // forced style
  ds.position = 'absolute';
  ds.left = '-9999px';
  ds.top = '-9999px';
  ds.zIndex = '-1';
  ds.visibility = 'hidden';
  ds.pointerEvents = 'none';
  ds.padding = '0';
  ds.lineHeight = '1';

  if( ele.pstyle( 'text-wrap' ).value === 'wrap' ){
    ds.whiteSpace = 'pre'; // so newlines are taken into account
  } else {
    ds.whiteSpace = 'normal';
  }

  // put label content in div
  div.textContent = text;

  cache[ cacheKey ] = {
    width: Math.ceil( div.clientWidth / sizeMult ),
    height: Math.ceil( div.clientHeight / sizeMult )
  };

  return cache[ cacheKey ];
};


BRp.calculateLabelAngles = function( ele ){
  var _p = ele._private;
  var rs = _p.rscratch;
  var isEdge = ele.isEdge();
  var rot = ele.pstyle( 'text-rotation' );
  var rotStr = rot.strValue;

  if( rotStr === 'none' ){
    rs.labelAngle = rs.sourceLabelAngle = rs.targetLabelAngle = 0;
  } else if( isEdge && rotStr === 'autorotate' ){
    rs.labelAngle = Math.atan( rs.midDispY / rs.midDispX );
    rs.sourceLabelAngle = rs.sourceLabelAutoAngle;
    rs.targetLabelAngle = rs.targetLabelAutoAngle;
  } else if( rotStr === 'autorotate' ){
    rs.labelAngle = rs.sourceLabelAngle = rs.targetLabelAngle = 0;
  } else {
    rs.labelAngle = rs.sourceLabelAngle = rs.targetLabelAngle = rot.pfValue;
  }
};

module.exports = BRp;
