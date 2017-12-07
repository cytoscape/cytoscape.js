let hashIterableInts = function( iterator, seed = 5381 ){ // djb2/string-hash
  let hash = seed;
  let entry;

  for( ;; ){
    entry = iterator.next();

    if( entry.done ){ break; }

    hash = (hash * 33) ^ entry.value;
  }

  return hash >>> 0;
};

let hashString = function( str, seed ){
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

module.exports = { hashIterableInts, hashString };
