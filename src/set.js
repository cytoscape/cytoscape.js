/* global Set */

const undef = typeof undefined;

class ObjectSet {
  constructor( arrayOrObjectSet ){
    this._obj = Object.create(null);

    if( arrayOrObjectSet != null ){
      let arr;

      if( arrayOrObjectSet.instanceString != null && arrayOrObjectSet.instanceString() === this.instanceString() ){
        arr = arrayOrObjectSet.toArray();
      } else {
        arr = arrayOrObjectSet;
      }

      for( let i = 0; i < arr.length; i++ ){
        this.add( arr[i] );
      }
    }
  }

  get size(){
    return this.toArray().length;
  }

  instanceString(){
    return 'set';
  }

  add( val ){
    this._obj[ val ] = 1;
  }

  delete( val ){
    this._obj[ val ] = 0;
  }

  clear(){
    this._obj = Object.create(null);
  }

  has( val ){
    return this._obj[ val ] === 1;
  }

  toArray(){
    return Object.keys( this._obj ).filter( key => this.has(key) );
  }

  forEach( callback, thisArg ){
    return this.toArray().forEach( callback, thisArg );
  }
}

// TODO use the stdlib Set in future...
// module.exports = typeof Set !== undef ? Set : ObjectSet;
module.exports = ObjectSet;
