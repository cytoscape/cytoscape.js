'use strict';

module.exports = [
  { name: 'arbor', impl: require('./arbor') },
  { name: 'breadthfirst', impl: require('./breadthfirst') },
  { name: 'circle', impl: require('./circle') },
  { name: 'cola',impl: require('./cola') },
  { name: 'concentric',impl: require('./concentric') },
  // { name: 'cose2', impl: require('./cose2') }, // TODO refactor
  { name: 'cose', impl: require('./cose') },
  { name: 'dagre', impl: require('./dagre') },
  { name: 'grid', impl: require('./grid') },
  { name: 'null', impl: require('./null') },
  { name: 'preset', impl: require('./preset') },
  { name: 'random', impl: require('./random') },
  // { name: 'spread', impl: require('./spread') },// TODO threads
  { name: 'springy', impl: require('./springy') }
];
