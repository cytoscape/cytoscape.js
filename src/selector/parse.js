const util = require('../util');
const exprs = require('./expressions');
const newQuery = require('./new-query');

// of all the expressions, find the first match in the remaining text
let consumeExpr = function( remaining ){
  let expr;
  let match;
  let name;

  for( let j = 0; j < exprs.length; j++ ){
    let e = exprs[ j ];
    let n = e.name;

    let m = remaining.match( e.regexObj );

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
    name: name,
    remaining: remaining
  };
};


// consume all leading whitespace
let consumeWhitespace = function( remaining ){
  let match = remaining.match( /^\s+/ );

  if( match ){
    let consumed = match[0];
    remaining = remaining.substring( consumed.length );
  }

  return remaining;
};

let parse = function( selector ){
  let self = this;

  let remaining = self._private.selectorText = selector;

  let currentQuery = self[0] = newQuery();
  self.length = 1;

  remaining = consumeWhitespace( remaining ); // get rid of leading whitespace

  for( ;; ){
    let check = consumeExpr( remaining );

    if( check.expr == null ){
      util.error( 'The selector `' + selector + '`is invalid' );
      return false;
    } else {
      let args = check.match.slice( 1 );

      // let the token populate the selector object in currentQuery
      let ret = check.expr.populate( self, currentQuery, args );

      if( ret === false ){
        return false; // exit if population failed
      } else if( ret != null ){
        currentQuery = ret; // change the current query to be filled if the expr specifies
      }
    }

    remaining = check.remaining;

    // we're done when there's nothing left to parse
    if( remaining.match( /^\s*$/ ) ){
      break;
    }
  }

  // adjust references for subject
  for( let j = 0; j < self.length; j++ ){
    let query = self[ j ];

    if( query.subject != null ){
      // go up the tree until we reach the subject
      for( ;; ){
        if( query.subject === query ){ break; } // done if subject is self

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
        } else if( query.source || query.target || query.connectedNodes ){
          util.error( 'The selector `' + self.text() + '` can not contain a subject selector that applies to the source or target of an edge selector' );
          return false;
        } else {
          util.error( 'When adjusting references for the selector `' + self.text() + '`, neither parent nor ancestor was found' );
          return false;
        }
      } // for

      self[ j ] = query.subject; // subject should be the root query
    } // if
  } // for

  return true; // success
};

module.exports = { parse };
