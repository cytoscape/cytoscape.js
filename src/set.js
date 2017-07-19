/* global Set, Symbol */

const undef = typeof undefined;
const iterator = typeof Symbol !== undef ? Symbol.iterator : '@@iterator';
const ArrayIterator = require('./array-iterator');

class ObjectSet {
  constructor( iterable ){
    this._obj = {};

    if( iterable != null ){
      for( let val of iterable ){
        this.add( val );
      }
    }
  }

  add( val ){
    this._obj[ val ] = 1;
  }

  delete( val ){
    this._obj[ val ] = 0;
  }

  clear(){
    this._obj = {};
  }

  has( val ){
    return this._obj[ val ] === 1;
  }

  toArray(){
    return Object.keys( this._obj ).filter( key => this.has(key) );
  }

  values(){
    return new ArrayIterator( this.toArray() );
  }

  entries(){
    return new ArrayIterator( this.toArray().map( val => [ val, val ] ) );
  }

  size(){
    return this.values().length;
  }

  forEach( callback, thisArg ){
    return this.values().forEach( callback, thisArg );
  }
}

ObjectSet.prototype[ iterator ] = ObjectSet.prototype.values;

module.exports = typeof Set !== undef ? Set : ObjectSet;
