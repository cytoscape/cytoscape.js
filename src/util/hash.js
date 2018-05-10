export const hashIterableInts = function( iterator, seed = 5381 ){ // djb2/string-hash
  let hash = seed;
  let entry;

  for( ;; ){
    entry = iterator.next();

    if( entry.done ){ break; }

    hash = (hash * 33) ^ entry.value;
  }

  return hash >>> 0;
};

export const hashInt = function( num, seed = 5381 ){ // djb2/string-hash
  return ( (seed * 33) ^ num ) >>> 0;
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
