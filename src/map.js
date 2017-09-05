class ObjectMap {
  constructor(){
    this._obj = {};
  }

  set( key, val ){
    this._obj[ key ] = val;

    return this;
  }

  delete( key ){
    this._obj[ key ] = undefined;

    return this;
  }

  clear(){
    this._obj = {};
  }

  has( key ){
    return this._obj[ key ] !== undefined;
  }

  get( key ){
    return this._obj[ key ];
  }
}

// TODO use the stdlib Map in future...
// module.exports = typeof Map !== 'undefined' ? Map : ObjectMap;
module.exports = ObjectMap;
