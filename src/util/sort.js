function ascending( a, b ){
  if( a < b ){
    return -1;
  } else if( a > b ){
    return 1;
  } else {
    return 0;
  }
}

function descending( a, b ){
  return -1 * ascending( a, b );
}

export var sort = {
  ascending: ascending,
  descending: descending
};
