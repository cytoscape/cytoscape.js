import Map from '../../../map.mjs';
import Set from'../../../set.mjs';
import * as util from '../../../util/index.mjs';
import type { MapLike } from '../../../map.mjs';
import type { SetLike } from '../../../set.mjs';
import type { Element } from '../renderer-types.mjs';

// keys produced by getKey may be of any hashable type (style/label keys)
type Key = unknown;
type Id = string | undefined; // ele.id() may be undefined for unrestored elements
// individual texture cache entries are opaque structures owned by the texture-cache classes
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque cache entry
type Cache = any;

// Allows lookups for (ele, lvl) => cache.
// Uses keys so elements may share the same cache.
class ElementTextureCacheLookup {
  idsByKey: MapLike<Key, SetLike<Id>>;
  keyForId: MapLike<Id, Key>;
  cachesByLvl: MapLike<number, MapLike<Key, Cache>>;
  lvls: number[];
  getKey: ( ele: Element ) => Key;
  doesEleInvalidateKey: ( ele: Element ) => boolean;

  constructor( getKey: ( ele: Element ) => Key, doesEleInvalidateKey: ( ele: Element ) => boolean = util.falsify ){
    this.idsByKey = new Map();
    this.keyForId = new Map();
    this.cachesByLvl = new Map();
    this.lvls = [];
    this.getKey = getKey;
    this.doesEleInvalidateKey = doesEleInvalidateKey;
  }

  getIdsFor(key: Key): SetLike<Id> {
    if( key == null ){
      util.error(`Can not get id list for null key`);
    }

    let { idsByKey } = this;
    let ids = this.idsByKey.get(key);

    if( !ids ){
      ids = new Set();

      idsByKey.set(key, ids);
    }

    return ids;
  }

  addIdForKey(key: Key, id: Id){
    if( key != null ){
      this.getIdsFor(key).add(id);
    }
  }

  deleteIdForKey(key: Key, id: Id){
    if( key != null ){
      this.getIdsFor(key).delete(id);
    }
  }

  getNumberOfIdsForKey(key: Key){
    if( key == null ){
      return 0;
    } else {
      return this.getIdsFor(key).size;
    }
  }

  updateKeyMappingFor(ele: Element){
    let id = ele.id();
    let prevKey = this.keyForId.get(id);
    let currKey = this.getKey(ele);

    this.deleteIdForKey(prevKey, id);

    this.addIdForKey(currKey, id);

    this.keyForId.set(id, currKey);
  }

  deleteKeyMappingFor(ele: Element){
    let id = ele.id();
    let prevKey = this.keyForId.get(id);

    this.deleteIdForKey(prevKey, id);

    this.keyForId.delete(id);
  }

  keyHasChangedFor(ele: Element){
    let id = ele.id();
    let prevKey = this.keyForId.get(id);
    let newKey = this.getKey(ele);

    return prevKey !== newKey;
  }

  isInvalid(ele: Element){
    return this.keyHasChangedFor(ele) || this.doesEleInvalidateKey(ele);
  }

  getCachesAt(lvl: number): MapLike<Key, Cache> {
    let { cachesByLvl, lvls } = this;
    let caches = cachesByLvl.get(lvl);

    if( !caches ){
      caches = new Map();

      cachesByLvl.set(lvl, caches);
      lvls.push(lvl);
    }

    return caches;
  }

  getCache(key: Key, lvl: number){
    return this.getCachesAt(lvl).get(key);
  }

  get(ele: Element, lvl: number){
    let key = this.getKey(ele);
    let cache = this.getCache(key, lvl);

    // getting for an element may need to add to the id list b/c eles can share keys
    if( cache != null ){
      this.updateKeyMappingFor(ele);
    }

    return cache;
  }

  getForCachedKey(ele: Element, lvl: number){
    let key = this.keyForId.get(ele.id()); // n.b. use cached key, not newly computed key
    let cache = this.getCache(key, lvl);

    return cache;
  }

  hasCache(key: Key, lvl: number){
    return this.getCachesAt(lvl).has(key);
  }

  has(ele: Element, lvl: number){
    let key = this.getKey(ele);

    return this.hasCache(key, lvl);
  }

  setCache(key: Key, lvl: number, cache: Cache){
    cache.key = key;

    this.getCachesAt(lvl).set(key, cache);
  }

  set(ele: Element, lvl: number, cache: Cache){
    let key = this.getKey(ele);

    this.setCache(key, lvl, cache);
    this.updateKeyMappingFor(ele);
  }

  deleteCache(key: Key, lvl: number){
    this.getCachesAt(lvl).delete(key);
  }

  delete(ele: Element, lvl: number){
    let key = this.getKey(ele);

    this.deleteCache(key, lvl);
  }

  invalidateKey(key: Key){
    this.lvls.forEach( lvl => this.deleteCache(key, lvl) );
  }

  // returns true if no other eles reference the invalidated cache (n.b. other eles may need the cache with the same key)
  invalidate(ele: Element){
    let id = ele.id();
    let key = this.keyForId.get(id); // n.b. use stored key rather than current (potential key)

    this.deleteKeyMappingFor(ele);

    let entireKeyInvalidated = this.doesEleInvalidateKey(ele);

    if( entireKeyInvalidated ){ // clear mapping for current key
      this.invalidateKey(key);
    }

    return entireKeyInvalidated || this.getNumberOfIdsForKey(key) === 0;
  }
}

export default ElementTextureCacheLookup;
