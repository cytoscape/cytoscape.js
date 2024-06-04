
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

export function transformMatrix4x4(x, y, zoom) {
  const mat = new Array(16).fill(0);
  mat[0] = zoom;
  mat[5] = zoom;
  mat[10] = 1;
  mat[12] = x;
  mat[13] = y;
  mat[15] = 1;
  return mat;
}

export function projectionMatrix4x4(width, height) {
  // maps the canvas space into clip space
  const near = -100;
  const far = 100; 
  const lr = 1 / (0 - width);
  const bt = 1 / (height - 0);
  const nf = 1 / (near - far);

  const mat = new Array(16).fill(0);
  mat[0] = -2 * lr;
  mat[5] = -2 * bt;
  mat[10] = 2 * nf;
  mat[12] = (0 + width) * lr;
  mat[13] = (0 + height) * bt;
  mat[14] = (far + near) * nf;
  mat[15] = 1;
  return mat;
}

export function multiply4x4(a, b) {
  const a00 = a[0],  a01 = a[1],  a02 = a[2],  a03 = a[3];
  const a10 = a[4],  a11 = a[5],  a12 = a[6],  a13 = a[7];
  const a20 = a[8],  a21 = a[9],  a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  const b00 = b[0],  b01 = b[1],  b02 = b[2],  b03 = b[3];
  const b10 = b[4],  b11 = b[5],  b12 = b[6],  b13 = b[7];
  const b20 = b[8],  b21 = b[9],  b22 = b[10], b23 = b[11];
  const b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];

  return [
    b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30,
    b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31,
    b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32,
    b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33,

    b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30,
    b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31,
    b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32,
    b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33,

    b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30,
    b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31,
    b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32,
    b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33,

    b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30,
    b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31,
    b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32,
    b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33,
  ];
}

