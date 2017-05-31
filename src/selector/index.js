const is = require('../is');
const util = require('../util');
const newQuery = require('./new-query');

let Selector = function( selector ){
  let self = this;

  self._private = {
    selectorText: selector,
    invalid: true
  };

  if( selector == null || ( is.string( selector ) && selector.match( /^\s*$/ ) ) ){

    self.length = 0;

  } else if( selector === '*' || selector === 'edge' || selector === 'node' ){

    // make single, group-only selectors cheap to make and cheap to filter

    self[0] = newQuery();
    self[0].group = selector === '*' ? selector : selector + 's';
    self[0].groupOnly = true;
    self[0].length = 1;
    self._private.invalid = false;
    self.length = 1;

  } else if( is.elementOrCollection( selector ) ){

    let collection = selector.collection();

    self[0] = newQuery();
    self[0].collection = collection;
    self[0].length = 1;
    self.length = 1;

  } else if( is.fn( selector ) ){

    self[0] = newQuery();
    self[0].filter = selector;
    self[0].length = 1;
    self.length = 1;

  } else if( is.string( selector ) ){
    if( !self.parse( selector ) ){ return; }

  } else {
    util.error( 'A selector must be created from a string; found ', selector );
    return;
  }

  self._private.invalid = false;
};

let selfn = Selector.prototype;

selfn.valid = function(){
  return !this._private.invalid;
};

selfn.invalid = function(){
  return this._private.invalid;
};

selfn.text = function(){
  return this._private.selectorText;
};

selfn.size = function(){
  return this.length;
};

selfn.eq = function( i ){
  return this[ i ];
};

selfn.sameText = function( otherSel ){
  return this.text() === otherSel.text();
};

selfn.toString = selfn.selector = function(){

  if( this._private.toStringCache != null ){
    return this._private.toStringCache;
  }

  let i;
  let str = '';

  let clean = function( obj ){
    if( obj == null ){
      return '';
    } else {
      return obj;
    }
  };

  let cleanVal = function( val ){
    if( is.string( val ) ){
      return '"' + val + '"';
    } else {
      return clean( val );
    }
  };

  let space = function( val ){
    return ' ' + val + ' ';
  };

  let queryToString = function( query ){
    let str = '';
    let j, sel;

    if( query.subject === query ){
      str += '$';
    }

    let group = clean( query.group );
    str += group.substring( 0, group.length - 1 );

    for( j = 0; j < query.data.length; j++ ){
      let data = query.data[ j ];

      if( data.value ){
        str += '[' + data.field + space( clean( data.operator ) ) + cleanVal( data.value ) + ']';
      } else {
        str += '[' + clean( data.operator ) + data.field + ']';
      }
    }

    for( j = 0; j < query.meta.length; j++ ){
      let meta = query.meta[ j ];
      str += '[[' + meta.field + space( clean( meta.operator ) ) + cleanVal( meta.value ) + ']]';
    }

    for( j = 0; j < query.colonSelectors.length; j++ ){
      sel = query.colonSelectors[ i ];
      str += sel;
    }

    for( j = 0; j < query.ids.length; j++ ){
      sel = '#' + query.ids[ i ];
      str += sel;
    }

    for( j = 0; j < query.classes.length; j++ ){
      sel = '.' + query.classes[ j ];
      str += sel;
    }

    if( query.source != null && query.target != null ){
      str = queryToString( query.source ) + ' -> ' + queryToString( query.target );
    }

    if( query.connectedNodes != null ){
      let n = query.connectedNodes;

      str = queryToString( n[0] ) + ' <-> ' + queryToString( n[1] );
    }

    if( query.parent != null ){
      str = queryToString( query.parent ) + ' > ' + str;
    }

    if( query.ancestor != null ){
      str = queryToString( query.ancestor ) + ' ' + str;
    }

    if( query.child != null ){
      str += ' > ' + queryToString( query.child );
    }

    if( query.descendant != null ){
      str += ' ' + queryToString( query.descendant );
    }

    return str;
  };

  for( i = 0; i < this.length; i++ ){
    let query = this[ i ];

    str += queryToString( query );

    if( this.length > 1 && i < this.length - 1 ){
      str += ', ';
    }
  }

  this._private.toStringCache = str;

  return str;
};

[
  require('./parse'),
  require('./matching')
].forEach( p => util.assign( selfn, p ) );

module.exports = Selector;
