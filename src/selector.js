'use strict';

let is = require( './is' );
let util = require( './util' );

let stateSelectors = [
  {
    selector: ':selected',
    matches: function( ele ){ return ele.selected(); }
  },
  {
    selector: ':unselected',
    matches: function( ele ){ return !ele.selected(); }
  },
  {
    selector: ':selectable',
    matches: function( ele ){ return ele.selectable(); }
  },
  {
    selector: ':unselectable',
    matches: function( ele ){ return !ele.selectable(); }
  },
  {
    selector: ':locked',
    matches: function( ele ){ return ele.locked(); }
  },
  {
    selector: ':unlocked',
    matches: function( ele ){ return !ele.locked(); }
  },
  {
    selector: ':visible',
    matches: function( ele ){ return ele.visible(); }
  },
  {
    selector: ':hidden',
    matches: function( ele ){ return !ele.visible(); }
  },
  {
    selector: ':transparent',
    matches: function( ele ){ return ele.transparent(); }
  },
  {
    selector: ':grabbed',
    matches: function( ele ){ return ele.grabbed(); }
  },
  {
    selector: ':free',
    matches: function( ele ){ return !ele.grabbed(); }
  },
  {
    selector: ':removed',
    matches: function( ele ){ return ele.removed(); }
  },
  {
    selector: ':inside',
    matches: function( ele ){ return !ele.removed(); }
  },
  {
    selector: ':grabbable',
    matches: function( ele ){ return ele.grabbable(); }
  },
  {
    selector: ':ungrabbable',
    matches: function( ele ){ return !ele.grabbable(); }
  },
  {
    selector: ':animated',
    matches: function( ele ){ return ele.animated(); }
  },
  {
    selector: ':unanimated',
    matches: function( ele ){ return !ele.animated(); }
  },
  {
    selector: ':parent',
    matches: function( ele ){ return ele.isParent(); }
  },
  {
    selector: ':childless',
    matches: function( ele ){ return ele.isChildless(); }
  },
  {
    selector: ':child',
    matches: function( ele ){ return ele.isChild(); }
  },
  {
    selector: ':orphan',
    matches: function( ele ){ return ele.isOrphan(); }
  },
  {
    selector: ':nonorphan',
    matches: function( ele ){ return ele.isChild(); }
  },
  {
    selector: ':loop',
    matches: function( ele ){ return ele.isLoop(); }
  },
  {
    selector: ':simple',
    matches: function( ele ){ return ele.isSimple(); }
  },
  {
    selector: ':active',
    matches: function( ele ){ return ele.active(); }
  },
  {
    selector: ':inactive',
    matches: function( ele ){ return !ele.active(); }
  },
  {
    selector: ':backgrounding',
    matches: function( ele ){ return ele.backgrounding(); }
  },
  {
    selector: ':nonbackgrounding',
    matches: function( ele ){ return !ele.backgrounding(); }
  }
].sort(function( a, b ){ // n.b. selectors that are starting substrings of others must have the longer ones first
  return util.sort.descending( a.selector, b.selector );
});

let stateSelectorMatches = function( sel, ele ){
  let lookup = stateSelectorMatches.lookup = stateSelectorMatches.lookup || (function(){
    let selToFn = {};
    let s;

    for( let i = 0; i < stateSelectors.length; i++ ){
      s = stateSelectors[i];

      selToFn[ s.selector ] = s.matches;
    }

    return selToFn;
  })();

  return lookup[ sel ]( ele );
};

let stateSelectorRegex = '(' + stateSelectors.map(function( s ){ return s.selector; }).join('|') + ')';

let Selector = function( selector ){
  let self = this;

  self._private = {
    selectorText: null,
    invalid: true
  };

  // storage for parsed queries
  let newQuery = function(){
    return {
      length: 0, // how many expressions per query

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
    self[0].length = 1;
    self._private.invalid = false;
    self._private.selectorText = selector;
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

    // the current subject in the query
    let currentSubject = null;

    // tokens in the query language
    let tokens = {
      metaChar: '[\\!\\"\\#\\$\\%\\&\\\'\\(\\)\\*\\+\\,\\.\\/\\:\\;\\<\\=\\>\\?\\@\\[\\]\\^\\`\\{\\|\\}\\~]', // chars we need to escape in let names, etc
      comparatorOp: '=|\\!=|>|>=|<|<=|\\$=|\\^=|\\*=', // binary comparison op (used in data selectors)
      boolOp: '\\?|\\!|\\^', // boolean (unary) operators (used in data selectors)
      string: '"(?:\\\\"|[^"])*"' + '|' + "'(?:\\\\'|[^'])*'", // string literals (used in data selectors) -- doublequotes | singlequotes
      number: util.regex.number, // number literal (used in data selectors) --- e.g. 0.1234, 1234, 12e123
      meta: 'degree|indegree|outdegree', // allowed metadata fields (i.e. allowed functions to use from Collection)
      separator: '\\s*,\\s*', // queries are separated by commas, e.g. edge[foo = 'bar'], node.someClass
      descendant: '\\s+',
      child: '\\s+>\\s+',
      subject: '\\$'
    };
    tokens.letiable = '(?:[\\w-]|(?:\\\\' + tokens.metaChar + '))+'; // a letiable name
    tokens.value = tokens.string + '|' + tokens.number; // a value literal, either a string or number
    tokens.className = tokens.letiable; // a class name (follows letiable conventions)
    tokens.id = tokens.letiable; // an element id (follows letiable conventions)

    // when a token like a letiable has escaped meta characters, we need to clean the backslashes out
    // so that values get compared properly in Selector.filter()
    let cleanMetaChars = function( str ){
      return str.replace( new RegExp( '\\\\(' + tokens.metaChar + ')', 'g' ), function( match, $1 ){
        return $1;
      } );
    };

    let ops, op, i;

    // add @ letiants to comparatorOp
    ops = tokens.comparatorOp.split( '|' );
    for( i = 0; i < ops.length; i++ ){
      op = ops[ i ];
      tokens.comparatorOp += '|@' + op;
    }

    // add ! letiants to comparatorOp
    ops = tokens.comparatorOp.split( '|' );
    for( i = 0; i < ops.length; i++ ){
      op = ops[ i ];

      if( op.indexOf( '!' ) >= 0 ){ continue; } // skip ops that explicitly contain !
      if( op === '=' ){ continue; } // skip = b/c != is explicitly defined

      tokens.comparatorOp += '|\\!' + op;
    }

    // NOTE: add new expression syntax here to have it recognised by the parser;
    // - a query contains all adjacent (i.e. no separator in between) expressions;
    // - the current query is stored in self[i] --- you can use the reference to `this` in the populate function;
    // - you need to check the query objects in Selector.filter() for it actually filter properly, but that's pretty straight forward
    // - when you add something here, also add to Selector.toString()
    let exprs = [
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
        regex: stateSelectorRegex,
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
        regex: '\\[\\s*(' + tokens.letiable + ')\\s*\\]',
        populate: function( letiable ){
          this.data.push( {
            field: cleanMetaChars( letiable )
          } );
        }
      },

      {
        name: 'dataCompare',
        query: true,
        regex: '\\[\\s*(' + tokens.letiable + ')\\s*(' + tokens.comparatorOp + ')\\s*(' + tokens.value + ')\\s*\\]',
        populate: function( letiable, comparatorOp, value ){
          let valueIsString = new RegExp( '^' + tokens.string + '$' ).exec( value ) != null;

          if( valueIsString ){
            value = value.substring( 1, value.length - 1 );
          } else {
            value = parseFloat( value );
          }

          this.data.push( {
            field: cleanMetaChars( letiable ),
            operator: comparatorOp,
            value: value
          } );
        }
      },

      {
        name: 'dataBool',
        query: true,
        regex: '\\[\\s*(' + tokens.boolOp + ')\\s*(' + tokens.letiable + ')\\s*\\]',
        populate: function( boolOp, letiable ){
          this.data.push( {
            field: cleanMetaChars( letiable ),
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
          let childQuery = newQuery();
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
          let descendantQuery = newQuery();
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
    let remaining = selector;

    i = 0;

    // of all the expressions, find the first match in the remaining text
    let consumeExpr = function( expectation ){
      let expr;
      let match;
      let name;

      for( let j = 0; j < exprs.length; j++ ){
        let e = exprs[ j ];
        let n = e.name;

        // ignore this expression if it doesn't meet the expectation function
        if( is.fn( expectation ) && !expectation( n, e ) ){ continue; }

        let m = remaining.match( new RegExp( '^' + e.regex ) );

        if( m != null ){
          match = m;
          expr = e;
          name = n;

          let consumed = m[0];
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
    let consumeWhitespace = function(){
      let match = remaining.match( /^\s+/ );

      if( match ){
        let consumed = match[0];
        remaining = remaining.substring( consumed.length );
      }
    };

    self[0] = newQuery(); // get started

    let j;

    consumeWhitespace(); // get rid of leading whitespace
    for( ;; ){
      let check = consumeExpr();

      if( check.expr == null ){
        util.error( 'The selector `' + selector + '`is invalid' );
        return;
      } else {
        let args = [];
        for( j = 1; j < check.match.length; j++ ){
          args.push( check.match[ j ] );
        }

        self[i].length++;

        // let the token populate the selector object (i.e. in self[i])
        let ret = check.expr.populate.apply( self[ i ], args );

        if( ret === false ){ return; } // exit if population failed
      }

      // we're done when there's nothing left to parse
      if( remaining.match( /^\s*$/ ) ){
        break;
      }
    }

    self.length = i + 1;

    // adjust references for subject
    for( j = 0; j < self.length; j++ ){
      let query = self[ j ];

      if( query.subject != null ){
        // go up the tree until we reach the subject
        for( ;; ){
          if( query.subject == query ){ break; } // done if subject is self

          if( query.parent != null ){ // swap parent/child reference
            let parent = query.parent;
            let child = query;

            child.parent = null;
            parent.child = child;

            query = parent; // go up the tree
          } else if( query.ancestor != null ){ // swap ancestor/descendant
            let ancestor = query.ancestor;
            let descendant = query;

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

let selfn = Selector.prototype;

selfn.size = function(){
  return this.length;
};

selfn.eq = function( i ){
  return this[ i ];
};

let queryMatches = function( query, ele ){
  // make single group-only selectors really cheap to check since they're the most common ones
  if( query.groupOnly ){
    return query.group === '*' || query.group === ele.group();
  }

  // check group
  if( query.group != null && query.group != '*' && query.group != ele.group() ){
    return false;
  }

  let cy = ele.cy();
  let k;

  // check colon selectors
  let allColonSelectorsMatch = true;
  for( k = 0; k < query.colonSelectors.length; k++ ){
    let sel = query.colonSelectors[ k ];

    allColonSelectorsMatch = stateSelectorMatches( sel, ele );

    if( !allColonSelectorsMatch ) break;
  }
  if( !allColonSelectorsMatch ) return false;

  // check id
  let allIdsMatch = true;
  for( k = 0; k < query.ids.length; k++ ){
    let id = query.ids[ k ];
    let actualId = ele.id();

    allIdsMatch = allIdsMatch && (id == actualId);

    if( !allIdsMatch ) break;
  }
  if( !allIdsMatch ) return false;

  // check classes
  let allClassesMatch = true;
  for( k = 0; k < query.classes.length; k++ ){
    let cls = query.classes[ k ];

    allClassesMatch = allClassesMatch && ele.hasClass( cls );

    if( !allClassesMatch ) break;
  }
  if( !allClassesMatch ) return false;

  // generic checking for data/metadata
  let operandsMatch = function( params ){
    let allDataMatches = true;
    for( let k = 0; k < query[ params.name ].length; k++ ){
      let data = query[ params.name ][ k ];
      let operator = data.operator;
      let value = data.value;
      let field = data.field;
      let matches;
      let fieldVal = params.fieldValue( field );

      if( operator != null && value != null ){
        let fieldStr = !is.string( fieldVal ) && !is.number( fieldVal ) ? '' : '' + fieldVal;
        let valStr = '' + value;

        let caseInsensitive = false;
        if( operator.indexOf( '@' ) >= 0 ){
          fieldStr = fieldStr.toLowerCase();
          valStr = valStr.toLowerCase();

          operator = operator.replace( '@', '' );
          caseInsensitive = true;
        }

        let notExpr = false;
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

        let isIneqCmp = false;

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
          matches = fieldVal ? true : false;
          break;
        case '!':
          matches = fieldVal ? false : true;
          break;
        case '^':
          matches = fieldVal === undefined;
          break;
        }
      } else {
        matches = fieldVal !== undefined;
      }

      if( !matches ){
        allDataMatches = false;
        break;
      }
    } // for

    return allDataMatches;
  }; // operandsMatch

  // check data matches
  let allDataMatches = operandsMatch( {
    name: 'data',
    fieldValue: function( field ){
      return ele.data( field );
    }
  } );

  if( !allDataMatches ){
    return false;
  }

  // check metadata matches
  let allMetaMatches = operandsMatch( {
    name: 'meta',
    fieldValue: function( field ){
      return ele[ field ]();
    }
  } );

  if( !allMetaMatches ){
    return false;
  }

  // check collection
  if( query.collection != null ){
    let matchesAny = query.collection.hasElementWithId( ele.id() );

    if( !matchesAny ){
      return false;
    }
  }

  // check filter function
  if( query.filter != null && ele.collection().some( query.filter ) ){
    return false;
  }

  // check parent/child relations
  let confirmRelations = function( query, eles ){
    if( query != null ){
      let matches = false;

      if( !cy.hasCompoundNodes() ){
        return false;
      }

      eles = eles(); // save cycles if query == null

      // query must match for at least one element (may be recursive)
      for( let i = 0; i < eles.length; i++ ){
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
  let self = this;
  let cy = collection.cy();

  // don't bother trying if it's invalid
  if( self._private.invalid ){
    return cy.collection();
  }

  // for 1 id #foo queries, just get the element
  if( self.length === 1 && self[0].length === 1 && self[0].ids.length === 1 ){
    return collection.getElementById( self[0].ids[0] ).collection();
  }

  let selectorFunction = function( element ){
    for( let j = 0; j < self.length; j++ ){
      let query = self[ j ];

      if( queryMatches( query, element ) ){
        return true;
      }
    }

    return false;
  };

  if( self._private.selectorText == null ){
    selectorFunction = function(){ return true; };
  }

  let filteredCollection = collection.filter( selectorFunction );

  return filteredCollection;
}; // filter

// does selector match a single element?
selfn.matches = function( ele ){
  let self = this;

  // don't bother trying if it's invalid
  if( self._private.invalid ){
    return false;
  }

  for( let j = 0; j < self.length; j++ ){
    let query = self[ j ];

    if( queryMatches( query, ele ) ){
      return true;
    }
  }

  return false;
}; // filter

selfn.sameText = function( otherSel ){
  return this._private.selectorText = otherSel._private.selectorText;
};

// ith query to string
selfn.toString = selfn.selector = function(){

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

  return str;
};

module.exports = Selector;
