const { stateSelectorRegex } = require('./state');
const tokens = require('./tokens');
const util = require('../util');
const newQuery = require('./new-query');

// when a token like a variable has escaped meta characters, we need to clean the backslashes out
// so that values get compared properly in Selector.filter()
const cleanMetaChars = function( str ){
  return str.replace( new RegExp( '\\\\(' + tokens.metaChar + ')', 'g' ), function( match, $1 ){
    return $1;
  } );
};

const replaceLastQuery = ( selector, examiningQuery, replacementQuery ) => {
  if( examiningQuery === selector[ selector.length - 1 ] ){
    selector[ selector.length - 1 ] = replacementQuery;
  }
};

// NOTE: add new expression syntax here to have it recognised by the parser;
// - a query contains all adjacent (i.e. no separator in between) expressions;
// - the current query is stored in selector[i] --- you can use the reference to `this` in the populate function;
// - you need to check the query objects in Selector.filter() for it actually filter properly, but that's pretty straight forward
// - when you add something here, also add to Selector.toString()
let exprs = [
  {
    name: 'group',
    query: true,
    regex: '(' + tokens.group + ')',
    populate: function( selector, query, [ group ] ){
      query.group = group === '*' ? group : group + 's';
    }
  },

  {
    name: 'state',
    query: true,
    regex: stateSelectorRegex,
    populate: function( selector, query, [ state ] ){
      query.colonSelectors.push( state );
    }
  },

  {
    name: 'id',
    query: true,
    regex: '\\#(' + tokens.id + ')',
    populate: function( selector, query,[ id ] ){
      query.ids.push( cleanMetaChars( id ) );
    }
  },

  {
    name: 'className',
    query: true,
    regex: '\\.(' + tokens.className + ')',
    populate: function( selector, query, [ className ] ){
      query.classes.push( cleanMetaChars( className ) );
    }
  },

  {
    name: 'dataExists',
    query: true,
    regex: '\\[\\s*(' + tokens.variable + ')\\s*\\]',
    populate: function( selector, query, [ variable ] ){
      query.data.push( {
        field: cleanMetaChars( variable )
      } );
    }
  },

  {
    name: 'dataCompare',
    query: true,
    regex: '\\[\\s*(' + tokens.variable + ')\\s*(' + tokens.comparatorOp + ')\\s*(' + tokens.value + ')\\s*\\]',
    populate: function( selector, query, [ variable, comparatorOp, value ] ){
      let valueIsString = new RegExp( '^' + tokens.string + '$' ).exec( value ) != null;

      if( valueIsString ){
        value = value.substring( 1, value.length - 1 );
      } else {
        value = parseFloat( value );
      }

      query.data.push( {
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
    populate: function( selector, query, [ boolOp, variable ] ){
      query.data.push( {
        field: cleanMetaChars( variable ),
        operator: boolOp
      } );
    }
  },

  {
    name: 'metaCompare',
    query: true,
    regex: '\\[\\[\\s*(' + tokens.meta + ')\\s*(' + tokens.comparatorOp + ')\\s*(' + tokens.number + ')\\s*\\]\\]',
    populate: function( selector, query, [ meta, comparatorOp, number ] ){
      query.meta.push( {
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
    populate: function( selector ){
      // go on to next query
      let nextQuery = selector[ selector.length++ ] = newQuery();
      selector.currentSubject = null;

      return nextQuery;
    }
  },

  {
    name: 'directedEdge',
    separator: true,
    regex: tokens.directedEdge,
    populate: function( selector, query ){
      let edgeQuery = newQuery();
      let source = query;
      let target = newQuery();

      edgeQuery.group = 'edges';
      edgeQuery.target = target;
      edgeQuery.source = source;
      edgeQuery.subject = selector.currentSubject;

      // the query in the selector should be the edge rather than the source
      replaceLastQuery( selector, query, edgeQuery );

      // we're now populating the target query with expressions that follow
      return target;
    }
  },

  {
    name: 'undirectedEdge',
    separator: true,
    regex: tokens.undirectedEdge,
    populate: function( selector, query ){
      let edgeQuery = newQuery();
      let source = query;
      let target = newQuery();

      edgeQuery.group = 'edges';
      edgeQuery.connectedNodes = [ source, target ];
      edgeQuery.subject = selector.currentSubject;

      // the query in the selector should be the edge rather than the source
      replaceLastQuery( selector, query, edgeQuery );

      // we're now populating the target query with expressions that follow
      return target;
    }
  },

  {
    name: 'child',
    separator: true,
    regex: tokens.child,
    populate: function( selector, query ){
      // this query is the parent of the following query
      let childQuery = newQuery();
      childQuery.parent = query;
      childQuery.subject = selector.currentSubject;

      // it's cheaper to compare children first and go up so replace the parent
      replaceLastQuery( selector, query, childQuery );

      // we're now populating the child query with expressions that follow
      return childQuery;
    }
  },

  {
    name: 'descendant',
    separator: true,
    regex: tokens.descendant,
    populate: function( selector, query ){
      // this query is the ancestor of the following query
      let descendantQuery = newQuery();
      descendantQuery.ancestor = query;
      descendantQuery.subject = selector.currentSubject;

      // it's cheaper to compare descendants first and go up so replace the ancestor
      replaceLastQuery( selector, query, descendantQuery );

      // we're now populating the descendant query with expressions that follow
      return descendantQuery;
    }
  },

  {
    name: 'subject',
    modifier: true,
    regex: tokens.subject,
    populate: function( selector, query ){
      if( selector.currentSubject != null && query.subject != query ){
        util.error( 'Redefinition of subject in selector `' + selector.toString() + '`' );
        return false;
      }

      selector.currentSubject = query;
      query.subject = query;
      selector[ selector.length - 1 ].subject = query;
    }
  }
];

exprs.forEach( e => e.regexObj = new RegExp( '^' + e.regex ) );

module.exports = exprs;
