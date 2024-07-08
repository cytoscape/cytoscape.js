
export function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  console.log(gl.getShaderInfoLog(shader));
  return shader;
}


export function createProgram(gl, vertexSource, fragementSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragementSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Could not initialize shaders');
  }
  return program;
}


export function createTextureCanvas(r, width, height) {
  if(height === undefined) {
    height = width;
  }
  const canvas = r.makeOffscreenCanvas(width, height);
  const ctx = canvas.context = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return canvas;
}


export function bufferTexture(gl, textureCanvas) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
 
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);

  // very important, this tells webgl to premultiply colors by the alpha channel
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureCanvas);
  gl.generateMipmap(gl.TEXTURE_2D);

  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}


/** @param {WebGLRenderingContext} gl */
export function createAttributeBufferStaticDraw(gl, { attributeLoc, dataArray, size, type }) {
  let data;
  if(type === gl.FLOAT) {
    data = new Float32Array(dataArray);
  } else if(type === gl.SHORT) {
    data = new Int16Array(dataArray);
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.vertexAttribPointer(attributeLoc, size, type, false, 0, 0);
  gl.enableVertexAttribArray(attributeLoc);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return buffer;
}


/** 
 * Creates a float buffer with gl.DYNAMIC_DRAW.
 * The returned buffer object contains functions to easily set instance data and buffer the data before a draw call.
 * @param {WebGLRenderingContext} gl 
 */
export function createInstanceBufferDynamicDraw(gl, { attributeLoc, maxInstances, size, type }) {
  let dataArray, stride;
  if(type === gl.FLOAT) {
    dataArray = new Float32Array(maxInstances * size);
    stride = size * 4; // num elements * 4 bytes (float)
  } else if(type === gl.INT) {
    dataArray = new Int32Array(maxInstances * size);
    stride = size * 4;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, maxInstances * stride, gl.DYNAMIC_DRAW); 
  gl.enableVertexAttribArray(attributeLoc);
  if(type === gl.FLOAT) {
    gl.vertexAttribPointer(attributeLoc, size, type, false, stride, 0);
  } else if(type === gl.INT) {
    gl.vertexAttribIPointer(attributeLoc, size, type, stride, 0);
  }
  gl.vertexAttribDivisor(attributeLoc, 1);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  buffer.dataArray = dataArray;
  buffer.stride = stride;
  buffer.size = size;

  buffer.setDataAt = (data, i) => {
    dataArray.set(data, i * size);
  };

  buffer.bufferSubData = (count) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if(count) {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, dataArray, 0, count * size);
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, dataArray); 
    }
  }

  return buffer;
}

/** 
 * Creates a buffer of 3x3 matrix data for use as attribute data.
 * @param {WebGLRenderingContext} gl 
 */
export function create3x3MatrixBufferDynamicDraw(gl, { maxInstances, attributeLoc } ) {
  const matrixSize = 9; // 3x3 matrix
  const matrixData = new Float32Array(maxInstances * matrixSize);

  // use matrix views to set values directly into the matrixData array
  const matrixViews = new Array(maxInstances);
  for(let i = 0; i < maxInstances; i++) {
    const byteOffset = i * matrixSize * 4; // 4 bytes per float
    matrixViews[i] = new Float32Array(matrixData.buffer, byteOffset, matrixSize); // array view
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, matrixData.byteLength, gl.DYNAMIC_DRAW);

  // each row of the matrix needs to be a separate attribute
  for(let i = 0; i < 3; i++) {
    const loc = attributeLoc + i;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 3 * 12, i * 12);
    gl.vertexAttribDivisor(loc, 1);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  buffer.getMatrixView = (i) => {
    return matrixViews[i];
  };

  buffer.bufferSubData = () => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, matrixData);
  };

  return buffer;
}