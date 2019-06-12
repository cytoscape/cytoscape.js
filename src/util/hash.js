const DJB2_MULT = 31;
const DJB2_SEED = 5381;

const PRIME1 = 668265263;
const PRIME2 = 374761393;

// marsenne primes
const PRIME3 = 2147483647;
const PRIME4 = 524287;
const PRIME5 = 127;

const DEFAULT_SEED = PRIME1;
const MULT = PRIME4;
// const DEFAULT_SEED = DJB2_SEED;
// const MULT = DJB2_MULT;

export const hashIterableInts = function( iterator, seed = DEFAULT_SEED ){ // djb2/string-hash
  let hash = seed;
  let entry;

  for( ;; ){
    entry = iterator.next();

    if( entry.done ){ break; }

    hash = (hash * MULT) ^ entry.value;
  }

  return hash >>> 0;
};

export const hashInt = function( num, seed = DEFAULT_SEED ){ // djb2/string-hash
  return ( (seed * MULT) ^ num ) >>> 0;
};

export const hashIntsArray = function( ints, seed ){
  let entry = { value: 0, done: false };
  let i = 0;
  let length = ints.length;

  let iterator = {
    next(){
      if( i < length ){
        entry.value = ints[i++];
      } else {
        entry.done = true;
      }

      return entry;
    }
  };

  return hashIterableInts( iterator, seed );
};

export const hashString = function( str, seed ){
  let entry = { value: 0, done: false };
  let i = 0;
  let length = str.length;

  let iterator = {
    next(){
      if( i < length ){
        entry.value = str.charCodeAt(i++);
      } else {
        entry.done = true;
      }

      return entry;
    }
  };

  return hashIterableInts( iterator, seed );
};

export const hashStrings = function(){
  return hashStringsArray( arguments );
};

export const hashStringsArray = function( strs ){
  let hash;

  for( let i = 0; i < strs.length; i++ ){
    let str = strs[i];

    if( i === 0 ){
      hash = hashString( str );
    } else {
      hash = hashString( str, hash );
    }
  }

  return hash;
};
