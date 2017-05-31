// storage for parsed queries
let newQuery = function(){
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

module.exports = newQuery;
