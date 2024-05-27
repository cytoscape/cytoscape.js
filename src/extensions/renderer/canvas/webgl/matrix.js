
export function transformMatrix3x3(x, y, zoom) {
  const mat = new Array(9).fill(0);
  mat[0] = zoom;
  mat[4] = zoom;
  mat[6] = x;
  mat[7] = y;
  mat[8] = 1;
  return mat;
}


export function projectionMatrix3x3(width, height) {
  // maps the canvas space into clip space
  const mat = new Array(9).fill(0);
  mat[0] = 2 / width;
  mat[4] = -2 / height;
  mat[6] = -1;
  mat[7] = 1;
  mat[8] = 1;
  return mat;
}


export function multiply3x3(a, b) {
  const a00 = a[0], a01 = a[1], a02 = a[2];
  const a10 = a[3], a11 = a[4], a12 = a[5];
  const a20 = a[6], a21 = a[7], a22 = a[8];

  const b00 = b[0], b01 = b[1], b02 = b[2];
  const b10 = b[3], b11 = b[4], b12 = b[5];
  const b20 = b[6], b21 = b[7], b22 = b[8];

  return [
    b00 * a00 + b01 * a10 + b02 * a20,
    b00 * a01 + b01 * a11 + b02 * a21,
    b00 * a02 + b01 * a12 + b02 * a22,
    b10 * a00 + b11 * a10 + b12 * a20,
    b10 * a01 + b11 * a11 + b12 * a21,
    b10 * a02 + b11 * a12 + b12 * a22,
    b20 * a00 + b21 * a10 + b22 * a20,
    b20 * a01 + b21 * a11 + b22 * a21,
    b20 * a02 + b21 * a12 + b22 * a22,
  ];
}
