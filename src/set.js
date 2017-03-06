function ObjectSet(){
  this._obj = {};
}

var p = ObjectSet.prototype;

p.add = function( val ){
  this._obj[ val ] = 1;
};

p.remove = function( val ){
  this._obj[ val ] = 0;
};

p.has = function( val ){
  return this._obj[ val ] === 1;
};

module.exports = typeof Set !== 'undefined' ? Set : ObjectSet;
