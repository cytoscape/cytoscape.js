const { stateSelectorMatches } = require('./state');
const is = require('../is');

// generic checking for data/metadata
let operandsMatch = function( query, params ){
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

// check parent/child relations
let confirmRelations = function( query, isNecessary, eles ){
  if( query != null ){
    let matches = false;

    if( !isNecessary ){ return false; }

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

  // check data matches
  let allDataMatches = operandsMatch( query, {
    name: 'data',
    fieldValue: function( field ){
      return ele.data( field );
    }
  } );

  if( !allDataMatches ){
    return false;
  }

  // check metadata matches
  let allMetaMatches = operandsMatch( query, {
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

  let isCompound = cy.hasCompoundNodes();
  let getSource = () => ele.source();
  let getTarget = () => ele.target();

  if( !confirmRelations( query.parent, isCompound, () => ele.parent() ) ){ return false; }

  if( !confirmRelations( query.ancestor, isCompound, () => ele.parents() ) ){ return false; }

  if( !confirmRelations( query.child, isCompound, () => ele.children() ) ){ return false; }

  if( !confirmRelations( query.descendant, isCompound, () => ele.descendants() ) ){ return false; }

  if( !confirmRelations( query.source, true, getSource ) ){ return false; }

  if( !confirmRelations( query.target, true, getTarget ) ){ return false; }

  if( query.connectedNodes ){
    let q0 = query.connectedNodes[0];
    let q1 = query.connectedNodes[1];

    if(
      confirmRelations( q0, true, getSource ) &&
      confirmRelations( q1, true, getTarget )
    ){
      // match
    } else if(
      confirmRelations( q0, true, getTarget ) &&
      confirmRelations( q1, true, getSource )
    ){
      // match
    } else {
      return false;
    }
  }

  // we've reached the end, so we've matched everything for this query
  return true;
}; // queryMatches

// filter an existing collection
let filter = function( collection ){
  let self = this;
  let cy = collection.cy();

  // don't bother trying if it's invalid
  if( self.invalid() ){
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

  if( self.text() == null ){
    selectorFunction = function(){ return true; };
  }

  let filteredCollection = collection.filter( selectorFunction );

  return filteredCollection;
}; // filter

// does selector match a single element?
let matches = function( ele ){
  let self = this;

  // don't bother trying if it's invalid
  if( self.invalid() ){
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

module.exports = { matches, filter };
