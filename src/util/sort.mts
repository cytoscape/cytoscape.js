export const ascending = <T extends string | number,>( a: T, b: T ): number => {
  if( a < b ){
    return -1;
  } else if( a > b ){
    return 1;
  } else {
    return 0;
  }
};

export const descending = <T extends string | number,>( a: T, b: T ): number => {
  return -1 * ascending( a, b );
};
