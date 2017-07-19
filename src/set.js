/* global Set */

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

  values(){
    return Object.keys( this._obj ).filter( key => this.has(key) );
  }

  entries(){
    return this.values.map( val => [ val, val ] );
  }

  size(){
    return this.values().length;
  }

  forEach( callback, thisArg ){
    return this.values().forEach( callback, thisArg );
  }
}

module.exports = typeof Set !== 'undefined' ? Set : ObjectSet;
