/* global Set */

function ObjectSet( iterable ){
  this._obj = {};

  for( let val of iterable ){
    this.add( val );
  }
}

let p = ObjectSet.prototype;

p.add = function( val ){
  this._obj[ val ] = 1;
};

p.remove = function( val ){
  this._obj[ val ] = 0;
};

p.has = function( val ){
  return this._obj[ val ] === 1;
};

p.values = function(){
  return Object.keys( this._obj ).filter( key => this.has(key) );
};

p.entries = function(){
  return this.values.map( val => [ val, val ] );
};

p.size = function(){
  return this.values().length;
};

p.clear = function(){
  this.values().forEach( val => this.remove(val) );
};

p.forEach = function( callback, thisArg ){
  return this.values().forEach( callback, thisArg );
};

module.exports = typeof Set !== 'undefined' ? Set : ObjectSet;
