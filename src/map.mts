/* global Map */

/**
 * Minimal structural Map interface satisfied by both the native `Map` and the
 * `ObjectMap` polyfill.  Note that the polyfill keys by object property, so
 * non-string keys are effectively stringified there — but in practice the
 * native `Map` is used and consumers rely on generic keys.
 */
export interface MapLike<K, V> {
  set( key: K, val: V ): this;
  delete( key: K ): void;
  clear(): void;
  has( key: K ): boolean;
  get( key: K ): V | undefined;
}

/**
 * Minimal structural constructor type for the default export.
 */
export interface MapConstructorLike {
  new <K, V>(): MapLike<K, V>;
}

class ObjectMap<V> {
  _obj: Record<PropertyKey, V | undefined>;

  constructor(){
    this._obj = {};
  }

  set( key: PropertyKey, val: V ): this {
    this._obj[ key ] = val;

    return this;
  }

  delete( key: PropertyKey ): this {
    this._obj[ key ] = undefined;

    return this;
  }

  clear(): void {
    this._obj = {};
  }

  has( key: PropertyKey ): boolean {
    return this._obj[ key ] !== undefined;
  }

  get( key: PropertyKey ): V | undefined {
    return this._obj[ key ];
  }
}

// The polyfill keys by object property (i.e. keys are effectively strings),
// so it can not literally satisfy the generic constructor type — the
// assertion gives consumers the honest, minimal Map-like surface shared by
// both implementations.
export default (typeof Map !== 'undefined' ? Map : ObjectMap) as unknown as MapConstructorLike;
