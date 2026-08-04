/* global Set */

const undef = typeof undefined;

/**
 * Minimal structural Set interface satisfied by both the native `Set` and the
 * `ObjectSet` polyfill.  Note that the polyfill keys by object property, so
 * non-string values are effectively stringified there — but in practice the
 * native `Set` is used and consumers rely on generic values.
 */
export interface SetLike<T> {
  size: number;
  add( val: T ): void;
  delete( val: T ): void;
  clear(): void;
  has( val: T ): boolean;
  forEach( callback: ( val: T ) => void, thisArg?: unknown ): void;
}

/**
 * Minimal structural constructor type for the default export.
 */
export interface SetConstructorLike {
  new <T>( items?: readonly T[] | SetLike<T> | null ): SetLike<T>;
}

class ObjectSet {
  _obj: Record<PropertyKey, number>;
  size: number;

  constructor( arrayOrObjectSet?: readonly PropertyKey[] | ObjectSet | null ){
    this._obj = Object.create(null);
    this.size = 0;

    if( arrayOrObjectSet != null ){
      let arr;

      if( (arrayOrObjectSet as ObjectSet).instanceString != null && (arrayOrObjectSet as ObjectSet).instanceString() === this.instanceString() ){
        arr = (arrayOrObjectSet as ObjectSet).toArray();
      } else {
        arr = arrayOrObjectSet as readonly PropertyKey[];
      }

      for( let i = 0; i < arr.length; i++ ){
        this.add( arr[i] );
      }
    }
  }

  instanceString(): string {
    return 'set';
  }

  add( val: PropertyKey ): void {
    let o = this._obj;

    if( o[ val ] !== 1 ){
      o[ val ] = 1;
      this.size++;
    }
  }

  delete( val: PropertyKey ): void {
    let o = this._obj;

    if( o[ val ] === 1 ){
      o[ val ] = 0;
      this.size--;
    }
  }

  clear(): void {
    this._obj = Object.create(null);
  }

  has( val: PropertyKey ): boolean {
    return this._obj[ val ] === 1;
  }

  toArray(): string[] {
    return Object.keys( this._obj ).filter( key => this.has(key) );
  }

  forEach( callback: ( value: string, index: number, array: string[] ) => void, thisArg?: unknown ): void {
    return this.toArray().forEach( callback, thisArg );
  }
}

// The polyfill keys by object property (i.e. values are effectively strings),
// so it can not literally satisfy the generic constructor type — the
// assertion gives consumers the honest, minimal Set-like surface shared by
// both implementations.
export default (typeof Set !== undef ? Set : ObjectSet) as unknown as SetConstructorLike;
