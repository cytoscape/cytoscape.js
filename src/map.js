function ObjectMap(){
  this._obj = {};
}

let p = ObjectMap.prototype;

p.set = function( key, val ){
  this._obj[ key ] = val;
};

p.delete = function( key ){
  this._obj[ key ] = null;
};

p.has = function( key ){
  return this._obj[ key ] != null;
};

p.get = function( key ){
  return this._obj[ key ];
};

module.exports = typeof Map !== 'undefined' ? Map : ObjectMap;
