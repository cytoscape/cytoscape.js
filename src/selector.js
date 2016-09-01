'use strict';

var is = require( './is' );
var util = require( './util' );

var Selector = function( selector ){

  if( !(this instanceof Selector) ){
    return new Selector( selector );
  }

  var self = this;

  self._private = {
    selectorText: null,
    invalid: true
  };

  // storage for parsed queries
  var newQuery = function(){
    return {
      classes: [],
      colonSelectors: [],
      data: [],
      group: null,
      ids: [],
      meta: [],

      // fake selectors
      collection: null, // a collection to match against
      filter: null, // filter function

      // these are defined in the upward direction rather than down (e.g. child)
      // because we need to go up in Selector.filter()
      parent: null, // parent query obj
      ancestor: null, // ancestor query obj
      subject: null, // defines subject in compound query (subject query obj; points to self if subject)

      // use these only when subject has been defined
      child: null,
      descendant: null
    };
  };

  if( !selector || ( is.string( selector ) && selector.match( /^\s*$/ ) ) ){

    self.length = 0;

  } else if( selector === '*' || selector === 'edge' || selector === 'node' ){

    // make single, group-only selectors cheap to make and cheap to filter

    self[0] = newQuery();
    self[0].group = selector === '*' ? selector : selector + 's';
    self[0].groupOnly = true;
    self._private.invalid = false;
    self._private.selectorText = selector;
    self.length = 1;

  } else if( is.elementOrCollection( selector ) ){

    var collection = selector.collection();

    self[0] = newQuery();
    self[0].collection = collection;
    self.length = 1;

  } else if( is.fn( selector ) ){

    self[0] = newQuery();
    self[0].filter = selector;
    self.length = 1;

  } else if( is.string( selector ) ){

    // the current subject in the query
    var currentSubject = null;

    // tokens in the query language
    var tokens = {
      metaChar: '[\\!\\"\\#\\$\\%\\&\\\'\\(\\)\\*\\+\\,\\.\\/\\:\\;\\<\\=\\>\\?\\@\\[\\]\\^\\`\\{\\|\\}\\~]', // chars we need to escape in var names, etc
      comparatorOp: '=|\\!=|>|>=|<|<=|\\$=|\\^=|\\*=', // binary comparison op (used in data selectors)
      boolOp: '\\?|\\!|\\^', // boolean (unary) operators (used in data selectors)
      string: '"(?:\\\\"|[^"])+"' + '|' + "'(?:\\\\'|[^'])+'", // string literals (used in data selectors) -- doublequotes | singlequotes
      number: util.regex.number, // number literal (used in data selectors) --- e.g. 0.1234, 1234, 12e123
      meta: 'degree|indegree|outdegree', // allowed metadata fields (i.e. allowed functions to use from Collection)
      separator: '\\s*,\\s*', // queries are separated by commas, e.g. edge[foo = 'bar'], node.someClass
      descendant: '\\s+',
      child: '\\s+>\\s+',
      subject: '\\$'
    };
    tokens.variable = '(?:[\\w-]|(?:\\\\' + tokens.metaChar + '))+'; // a variable name
    tokens.value = tokens.string + '|' + tokens.number; // a value literal, either a string or number
    tokens.className = tokens.variable; // a class name (follows variable conventions)
    tokens.id = tokens.variable; // an element id (follows variable conventions)

    // when a token like a variable has escaped meta characters, we need to clean the backslashes out
    // so that values get compared properly in Selector.filter()
    var cleanMetaChars = function( str ){
      return str.replace( new RegExp( '\\\\(' + tokens.metaChar + ')', 'g' ), function( match, $1, offset, original ){
        return $1;
      } );
    };

    // add @ variants to comparatorOp
    var ops = tokens.comparatorOp.split( '|' );
    for( var i = 0; i < ops.length; i++ ){
      var op = ops[ i ];
      tokens.comparatorOp += '|@' + op;
    }

    // add ! variants to comparatorOp
    var ops = tokens.comparatorOp.split( '|' );
    for( var i = 0; i < ops.length; i++ ){
      var op = ops[ i ];

      if( op.indexOf( '!' ) >= 0 ){ continue; } // skip ops that explicitly contain !
      if( op === '=' ){ continue; } // skip = b/c != is explicitly defined

      tokens.comparatorOp += '|\\!' + op;
    }

    // NOTE: add new expression syntax here to have it recognised by the parser;
    // - a query contains all adjacent (i.e. no separator in between) expressions;
    // - the current query is stored in self[i] --- you can use the reference to `this` in the populate function;
    // - you need to check the query objects in Selector.filter() for it actually filter properly, but that's pretty straight forward
    // - when you add something here, also add to Selector.toString()
    var exprs = [
      {
        name: 'group',
        query: true,
        regex: '(node|edge|\\*)',
        populate: function( group ){
          this.group = group === '*' ? group : group + 's';
        }
      },

      {
        name: 'state',
        query: true,
        // NB: if one colon selector is a substring of another from its start, place the longer one first
        // e.g. :foobar|:foo
        regex: '(:selected|:unselected|:locked|:unlocked|:visible|:hidden|:transparent|:grabbed|:free|:removed|:inside|:grabbable|:ungrabbable|:animated|:unanimated|:selectable|:unselectable|:orphan|:nonorphan|:parent|:child|:loop|:simple|:active|:inactive|:touch|:backgrounding|:nonbackgrounding)',
        populate: function( state ){
          this.colonSelectors.push( state );
        }
      },

      {
        name: 'id',
        query: true,
        regex: '\\#(' + tokens.id + ')',
        populate: function( id ){
          this.ids.push( cleanMetaChars( id ) );
        }
      },

      {
        name: 'className',
        query: true,
        regex: '\\.(' + tokens.className + ')',
        populate: function( className ){
          this.classes.push( cleanMetaChars( className ) );
        }
      },

      {
        name: 'dataExists',
        query: true,
        regex: '\\[\\s*(' + tokens.variable + ')\\s*\\]',
        populate: function( variable ){
          this.data.push( {
            field: cleanMetaChars( variable )
          } );
        }
      },

      {
        name: 'dataCompare',
        query: true,
        regex: '\\[\\s*(' + tokens.variable + ')\\s*(' + tokens.comparatorOp + ')\\s*(' + tokens.value + ')\\s*\\]',
        populate: function( variable, comparatorOp, value ){
          var valueIsString = new RegExp( '^' + tokens.string + '$' ).exec( value ) != null;

          if( valueIsString ){
            value = value.substring( 1, value.length - 1 );
          } else {
            value = parseFloat( value );
          }

          this.data.push( {
            field: cleanMetaChars( variable ),
            operator: comparatorOp,
            value: value
          } );
        }
      },

      {
        name: 'dataBool',
        query: true,
        regex: '\\[\\s*(' + tokens.boolOp + ')\\s*(' + tokens.variable + ')\\s*\\]',
        populate: function( boolOp, variable ){
          this.data.push( {
            field: cleanMetaChars( variable ),
            operator: boolOp
          } );
        }
      },

      {
        name: 'metaCompare',
        query: true,
        regex: '\\[\\[\\s*(' + tokens.meta + ')\\s*(' + tokens.comparatorOp + ')\\s*(' + tokens.number + ')\\s*\\]\\]',
        populate: function( meta, comparatorOp, number ){
          this.meta.push( {
            field: cleanMetaChars( meta ),
            operator: comparatorOp,
            value: parseFloat( number )
          } );
        }
      },

      {
        name: 'nextQuery',
        separator: true,
        regex: tokens.separator,
        populate: function(){
          // go on to next query
          self[ ++i ] = newQuery();
          currentSubject = null;
        }
      },

      {
        name: 'child',
        separator: true,
        regex: tokens.child,
        populate: function(){
          // this query is the parent of the following query
          var childQuery = newQuery();
          childQuery.parent = this;
          childQuery.subject = currentSubject;

          // we're now populating the child query with expressions that follow
          self[ i ] = childQuery;
        }
      },

      {
        name: 'descendant',
        separator: true,
        regex: tokens.descendant,
        populate: function(){
          // this query is the ancestor of the following query
          var descendantQuery = newQuery();
          descendantQuery.ancestor = this;
          descendantQuery.subject = currentSubject;

          // we're now populating the descendant query with expressions that follow
          self[ i ] = descendantQuery;
        }
      },

      {
        name: 'subject',
        modifier: true,
        regex: tokens.subject,
        populate: function(){
          if( currentSubject != null && this.subject != this ){
            util.error( 'Redefinition of subject in selector `' + selector + '`' );
            return false;
          }

          currentSubject = this;
          this.subject = this;
        }

      }
    ];

    self._private.selectorText = selector;
    var remaining = selector;
    var i = 0;

    // of all the expressions, find the first match in the remaining text
    var consumeExpr = function( expectation ){
      var expr;
      var match;
      var name;

      for( var j = 0; j < exprs.length; j++ ){
        var e = exprs[ j ];
        var n = e.name;

        // ignore this expression if it doesn't meet the expectation function
        if( is.fn( expectation ) && !expectation( n, e ) ){ continue; }

        var m = remaining.match( new RegExp( '^' + e.regex ) );

        if( m != null ){
          match = m;
          expr = e;
          name = n;

          var consumed = m[0];
          remaining = remaining.substring( consumed.length );

          break; // we've consumed one expr, so we can return now
        }
      }

      return {
        expr: expr,
        match: match,
        name: name
      };
    };

    // consume all leading whitespace
    var consumeWhitespace = function(){
      var match = remaining.match( /^\s+/ );

      if( match ){
        var consumed = match[0];
        remaining = remaining.substring( consumed.length );
      }
    };

    self[0] = newQuery(); // get started

    consumeWhitespace(); // get rid of leading whitespace
    for( ;; ){
      var check = consumeExpr();

      if( check.expr == null ){
        util.error( 'The selector `' + selector + '`is invalid' );
        return;
      } else {
        var args = [];
        for( var j = 1; j < check.match.length; j++ ){
          args.push( check.match[ j ] );
        }

        // let the token populate the selector object (i.e. in self[i])
        var ret = check.expr.populate.apply( self[ i ], args );

        if( ret === false ){ return; } // exit if population failed
      }

      // we're done when there's nothing left to parse
      if( remaining.match( /^\s*$/ ) ){
        break;
      }
    }

    self.length = i + 1;

    // adjust references for subject
    for( var j = 0; j < self.length; j++ ){
      var query = self[ j ];

      if( query.subject != null ){
        // go up the tree until we reach the subject
        for( ;; ){
          if( query.subject == query ){ break; } // done if subject is self

          if( query.parent != null ){ // swap parent/child reference
            var parent = query.parent;
            var child = query;

            child.parent = null;
            parent.child = child;

            query = parent; // go up the tree
          } else if( query.ancestor != null ){ // swap ancestor/descendant
            var ancestor = query.ancestor;
            var descendant = query;

            descendant.ancestor = null;
            ancestor.descendant = descendant;

            query = ancestor; // go up the tree
          } else {
            util.error( 'When adjusting references for the selector `' + query + '`, neither parent nor ancestor was found' );
            break;
          }
        } // for

        self[ j ] = query.subject; // subject should be the root query
      } // if
    } // for

  } else {
    util.error( 'A selector must be created from a string; found ' + selector );
    return;
  }

  self._private.invalid = false;

};

var selfn = Selector.prototype;

selfn.size = function(){
  return this.length;
};

selfn.eq = function( i ){
  return this[ i ];
};

var queryMatches = function( query, ele ){
  var ele_p = ele._private;

  // make single group-only selectors really cheap to check since they're the most common ones
  if( query.groupOnly ){
    return query.group === '*' || query.group === ele_p.group;
  }

  // check group
  if( query.group != null && query.group != '*' && query.group != ele_p.group ){
    return false;
  }

  var cy = ele.cy();

  // check colon selectors
  var allColonSelectorsMatch = true;
  for( var k = 0; k < query.colonSelectors.length; k++ ){
    var sel = query.colonSelectors[ k ];

    switch( sel ){
      case ':selected':
        allColonSelectorsMatch = ele.selected();
        break;
      case ':unselected':
        allColonSelectorsMatch = !ele.selected();
        break;
      case ':selectable':
        allColonSelectorsMatch = ele.selectable();
        break;
      case ':unselectable':
        allColonSelectorsMatch = !ele.selectable();
        break;
      case ':locked':
        allColonSelectorsMatch = ele.locked();
        break;
      case ':unlocked':
        allColonSelectorsMatch = !ele.locked();
        break;
      case ':visible':
        allColonSelectorsMatch = ele.visible();
        break;
      case ':hidden':
        allColonSelectorsMatch = !ele.visible();
        break;
      case ':transparent':
        allColonSelectorsMatch = ele.transparent();
        break;
      case ':grabbed':
        allColonSelectorsMatch = ele.grabbed();
        break;
      case ':free':
        allColonSelectorsMatch = !ele.grabbed();
        break;
      case ':removed':
        allColonSelectorsMatch = ele.removed();
        break;
      case ':inside':
        allColonSelectorsMatch = !ele.removed();
        break;
      case ':grabbable':
        allColonSelectorsMatch = ele.grabbable();
        break;
      case ':ungrabbable':
        allColonSelectorsMatch = !ele.grabbable();
        break;
      case ':animated':
        allColonSelectorsMatch = ele.animated();
        break;
      case ':unanimated':
        allColonSelectorsMatch = !ele.animated();
        break;
      case ':parent':
        allColonSelectorsMatch = ele.isNode() && ele.children().nonempty();
        break;
      case ':child':
      case ':nonorphan':
        allColonSelectorsMatch = ele.isNode() && ele.parent().nonempty();
        break;
      case ':orphan':
        allColonSelectorsMatch = ele.isNode() && ele.parent().empty();
        break;
      case ':loop':
        allColonSelectorsMatch = ele.isEdge() && ele.data( 'source' ) === ele.data( 'target' );
        break;
      case ':simple':
        allColonSelectorsMatch = ele.isEdge() && ele.data( 'source' ) !== ele.data( 'target' );
        break;
      case ':active':
        allColonSelectorsMatch = ele.active();
        break;
      case ':inactive':
        allColonSelectorsMatch = !ele.active();
        break;
      case ':touch':
        allColonSelectorsMatch = is.touch();
        break;
      case ':backgrounding':
        allColonSelectorsMatch = ele.backgrounding();
        break;
      case ':nonbackgrounding':
        allColonSelectorsMatch = !ele.backgrounding();
        break;
    }

    if( !allColonSelectorsMatch ) break;
  }
  if( !allColonSelectorsMatch ) return false;

  // check id
  var allIdsMatch = true;
  for( var k = 0; k < query.ids.length; k++ ){
    var id = query.ids[ k ];
    var actualId = ele_p.data.id;

    allIdsMatch = allIdsMatch && (id == actualId);

    if( !allIdsMatch ) break;
  }
  if( !allIdsMatch ) return false;

  // check classes
  var allClassesMatch = true;
  for( var k = 0; k < query.classes.length; k++ ){
    var cls = query.classes[ k ];

    allClassesMatch = allClassesMatch && ele.hasClass( cls );

    if( !allClassesMatch ) break;
  }
  if( !allClassesMatch ) return false;

  // generic checking for data/metadata
  var operandsMatch = function( params ){
    var allDataMatches = true;
    for( var k = 0; k < query[ params.name ].length; k++ ){
      var data = query[ params.name ][ k ];
      var operator = data.operator;
      var value = data.value;
      var field = data.field;
      var matches;

      if( operator != null && value != null ){

        var fieldVal = params.fieldValue( field );
        var fieldStr = !is.string( fieldVal ) && !is.number( fieldVal ) ? '' : '' + fieldVal;
        var valStr = '' + value;

        var caseInsensitive = false;
        if( operator.indexOf( '@' ) >= 0 ){
          fieldStr = fieldStr.toLowerCase();
          valStr = valStr.toLowerCase();

          operator = operator.replace( '@', '' );
          caseInsensitive = true;
        }

        var notExpr = false;
        if( operator.indexOf( '!' ) >= 0 ){
          operator = operator.replace( '!', '' );
          notExpr = true;
        }

        // if we're doing a case insensitive comparison, then we're using a STRING comparison
        // even if we're comparing numbers
        if( caseInsensitive ){
          value = valStr.toLowerCase();
          fieldVal = fieldStr.toLowerCase();
        }

        var isIneqCmp = false;

        switch( operator ){
        case '*=':
          matches = fieldStr.indexOf( valStr ) >= 0;
          break;
        case '$=':
          matches = fieldStr.indexOf( valStr, fieldStr.length - valStr.length ) >= 0;
          break;
        case '^=':
          matches = fieldStr.indexOf( valStr ) === 0;
          break;
        case '=':
          matches = fieldVal === value;
          break;
        case '>':
          isIneqCmp = true;
          matches = fieldVal > value;
          break;
        case '>=':
          isIneqCmp = true;
          matches = fieldVal >= value;
          break;
        case '<':
          isIneqCmp = true;
          matches = fieldVal < value;
          break;
        case '<=':
          isIneqCmp = true;
          matches = fieldVal <= value;
          break;
        default:
          matches = false;
          break;
        }

        // apply the not op, but null vals for inequalities should always stay non-matching
        if( notExpr && ( fieldVal != null || !isIneqCmp ) ){
          matches = !matches;
        }
      } else if( operator != null ){
        switch( operator ){
        case '?':
          matches = params.fieldTruthy( field );
          break;
        case '!':
          matches = !params.fieldTruthy( field );
          break;
        case '^':
          matches = params.fieldUndefined( field );
          break;
        }
      } else {
        matches = !params.fieldUndefined( field );
      }

      if( !matches ){
        allDataMatches = false;
        break;
      }
    } // for

    return allDataMatches;
  }; // operandsMatch

  // check data matches
  var allDataMatches = operandsMatch( {
    name: 'data',
    fieldValue: function( field ){
      return ele_p.data[ field ];
    },
    fieldUndefined: function( field ){
      return ele_p.data[ field ] === undefined;
    },
    fieldTruthy: function( field ){
      if( ele_p.data[ field ] ){
        return true;
      }
      return false;
    }
  } );

  if( !allDataMatches ){
    return false;
  }

  // check metadata matches
  var allMetaMatches = operandsMatch( {
    name: 'meta',
    fieldValue: function( field ){
      return ele[ field ]();
    },
    fieldUndefined: function( field ){
      return ele[ field ]() == null;
    },
    fieldTruthy: function( field ){
      if( ele[ field ]() ){
        return true;
      }
      return false;
    }
  } );

  if( !allMetaMatches ){
    return false;
  }

  // check collection
  if( query.collection != null ){
    var matchesAny = query.collection.hasElementWithId( ele.id() );

    if( !matchesAny ){
      return false;
    }
  }

  // check filter function
  if( query.filter != null && ele.collection().filter( query.filter ).size() === 0 ){
    return false;
  }

  // check parent/child relations
  var confirmRelations = function( query, eles ){
    if( query != null ){
      var matches = false;

      if( !cy.hasCompoundNodes() ){
        return false;
      }

      eles = eles(); // save cycles if query == null

      // query must match for at least one element (may be recursive)
      for( var i = 0; i < eles.length; i++ ){
        if( queryMatches( query, eles[ i ] ) ){
          matches = true;
          break;
        }
      }

      return matches;
    } else {
      return true;
    }
  };

  if( !confirmRelations( query.parent, function(){
    return ele.parent();
  } ) ){ return false; }

  if( !confirmRelations( query.ancestor, function(){
    return ele.parents();
  } ) ){ return false; }

  if( !confirmRelations( query.child, function(){
    return ele.children();
  } ) ){ return false; }

  if( !confirmRelations( query.descendant, function(){
    return ele.descendants();
  } ) ){ return false; }

  // we've reached the end, so we've matched everything for this query
  return true;
}; // queryMatches

// filter an existing collection
selfn.filter = function( collection ){
  var self = this;
  var cy = collection.cy();

  // don't bother trying if it's invalid
  if( self._private.invalid ){
    return cy.collection();
  }

  var selectorFunction = function( i, element ){
    for( var j = 0; j < self.length; j++ ){
      var query = self[ j ];

      if( queryMatches( query, element ) ){
        return true;
      }
    }

    return false;
  };

  if( self._private.selectorText == null ){
    selectorFunction = function(){ return true; };
  }

  var filteredCollection = collection.filter( selectorFunction );

  return filteredCollection;
}; // filter

// does selector match a single element?
selfn.matches = function( ele ){
  var self = this;

  // don't bother trying if it's invalid
  if( self._private.invalid ){
    return false;
  }

  for( var j = 0; j < self.length; j++ ){
    var query = self[ j ];

    if( queryMatches( query, ele ) ){
      return true;
    }
  }

  return false;
}; // filter

// ith query to string
selfn.toString = selfn.selector = function(){

  var str = '';

  var clean = function( obj ){
    if( obj == null ){
      return '';
    } else {
      return obj;
    }
  };

  var cleanVal = function( val ){
    if( is.string( val ) ){
      return '"' + val + '"';
    } else {
      return clean( val );
    }
  };

  var space = function( val ){
    return ' ' + val + ' ';
  };

  var queryToString = function( query ){
    var str = '';

    if( query.subject === query ){
      str += '$';
    }

    var group = clean( query.group );
    str += group.substring( 0, group.length - 1 );

    for( var j = 0; j < query.data.length; j++ ){
      var data = query.data[ j ];

      if( data.value ){
        str += '[' + data.field + space( clean( data.operator ) ) + cleanVal( data.value ) + ']';
      } else {
        str += '[' + clean( data.operator ) + data.field + ']';
      }
    }

    for( var j = 0; j < query.meta.length; j++ ){
      var meta = query.meta[ j ];
      str += '[[' + meta.field + space( clean( meta.operator ) ) + cleanVal( meta.value ) + ']]';
    }

    for( var j = 0; j < query.colonSelectors.length; j++ ){
      var sel = query.colonSelectors[ i ];
      str += sel;
    }

    for( var j = 0; j < query.ids.length; j++ ){
      var sel = '#' + query.ids[ i ];
      str += sel;
    }

    for( var j = 0; j < query.classes.length; j++ ){
      var sel = '.' + query.classes[ j ];
      str += sel;
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

  for( var i = 0; i < this.length; i++ ){
    var query = this[ i ];

    str += queryToString( query );

    if( this.length > 1 && i < this.length - 1 ){
      str += ', ';
    }
  }

  return str;
};

module.exports = Selector;
