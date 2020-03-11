const DEFAULT_SEED = 9261;
const K = 65599; // 37 also works pretty well

export const hashIterableInts = function( iterator, seed = DEFAULT_SEED ){ // sdbm/string-hash
  let hash = seed;
  let entry;

  for( ;; ){
    entry = iterator.next();

    if( entry.done ){ break; }

    hash = ((hash * K) + entry.value) | 0;
  }

  return hash;
};

export const hashInt = function( num, seed = DEFAULT_SEED ){ // sdbm/string-hash
  return ((seed * K) + num) | 0;
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
