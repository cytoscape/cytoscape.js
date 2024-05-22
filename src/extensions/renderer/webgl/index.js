const WGLp = WebGLRenderer.prototype;

function WebGLRenderer(options) {
  const r = this;

  const containerWindow = r.cy.window();
  const document = containerWindow.document;
  const canvasContainer = document.createElement('div');

  const containerStyle = canvasContainer.style;
  containerStyle.position = 'relative';
  containerStyle.zIndex = '0';
  containerStyle.overflow = 'hidden';

  const container = options.cy.container();
  container.appendChild(canvasContainer);

  const canvas = document.createElement('canvas');
  canvasContainer.appendChild(canvas);
  canvas.style.position = 'absolute';

  const gl = canvas.getContext('webgl2');
  if(!gl) {
    throw new Error("Browser does not support WebGL2");
  }

  gl.clearColor(0, 0, 0, 0); // background color

  const program = createShaderProgram(gl);

  r.data = { 
    canvas,
    canvasContainer,
    gl,
    program,
    context: gl,
    needRedraw: {
      node: false,
      select: false,
    }
  };
}


WGLp.redrawHint = function(group, bool) {
  var r = this;
  switch(group) {
    case 'eles':
      break;
    case 'drag':
      break;
    case 'select':
      break;
  }
};


WGLp.matchCanvasSize = function(container) { // Resize canvas
  console.log('webgl matchCanvasSize');
  const r = this;

  const pixelRatio = window.devicePixelRatio;

  const [,, width, height ] = r.findContainerClientCoords();
  const canvasWidth  = width  * pixelRatio;
  const canvasHeight = height * pixelRatio;

  const { canvasContainer, canvas } = r.data;
  canvasContainer.style.width  = width  + 'px';
  canvasContainer.style.height = height + 'px';
  canvas.width  = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.width  = width  + 'px';
  canvas.style.height = height + 'px';

  r.pixelRatio = pixelRatio;
  r.canvasWidth  = canvasWidth;
  r.canvasHeight = canvasHeight;
};

WGLp.nodeShapeImpl = function(name, context, centerX, centerY, width, height, points, corners) {
};

WGLp.arrowShapeImpl = function(name) {
};

WGLp.renderTo = function(cxt, zoom, pan, pxRatio) {
  this.render({
    forcedContext: cxt,
    forcedZoom: zoom,
    forcedPan: pan,
    // drawAllLayers: true,
    forcedPxRatio: pxRatio
  });
};


function createVertexArrays(eles) {
  const nodeVertexArray = [];
  const edgeVertexArray = [];
  let nodeCount = 0;
  let edgeCount = 0;
  let z = 0; // A f32 can exactly represent integer values in the range [−16777216, 16777216]

  // TODO need to add Z coord so that ordering is correct?
  // Or maybe just drawing them in order will do the trick?
  // No,,, vertex shaders run in parallel
  for(let i = 0; i < eles.length; i++) {
    const ele = eles[i];
    if(ele.isNode()) {
      const node = ele;
      const pos = node.position();
      const padding = node.padding();
      const nodeWidth = node.width() + 2 * padding;
      const nodeHeight = node.height() + 2 * padding;
      const halfW = nodeWidth / 2;
      const halfH = nodeHeight / 2;
      
      const topY = pos.y + halfH;
      const botY = pos.y - halfH;
      const leftX = pos.x - halfW;
      const rightX = pos.x + halfW;
  
      // 6 vertices per node (for now)
      nodeVertexArray.push(
        leftX, botY, z,
        rightX, botY, z,
        rightX, topY, z,
        leftX, botY, z,
        rightX, topY, z,
        leftX, topY, z
      );

      nodeCount++;
      // z++;

    } else {
      const edge = ele;
      const sp = edge.source().position();
      const tp = edge.target().position();

      edgeVertexArray.push(
        sp.x, sp.y, z, 
        tp.x, tp.y, z
      );
      
      edgeCount++;
    }
  }

  return {
    nodeVertexArray,
    nodeCount,
    edgeVertexArray,
    edgeCount,
  }
}


function createMatrices(r) {

  function getTransformMatrix() {
    const zoom = r.cy.zoom();
    const pan  = r.cy.pan();

    const eZoom = zoom  * r.pixelRatio;
    const ePanx = pan.x * r.pixelRatio;
    const ePany = pan.y * r.pixelRatio;
  
    const mat = new Array(16).fill(0);
    mat[0] = eZoom;
    mat[5] = eZoom;
    mat[10] = 1;
    mat[12] = ePanx;
    mat[13] = ePany;
    mat[15] = 1;
    return mat;
  }

  function getProjectionMatrix() {
    // maps the canvas space into clip space
    const width  = r.canvasWidth;
    const height = r.canvasHeight;
    const near = -10;
    const far = 10; // TODO set near/far to reasonable values that can show all z-indicies
    
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

  const transformMatrix  = getTransformMatrix();
  const projectionMatrix = getProjectionMatrix();

  return {
    transformMatrix,
    projectionMatrix
  };
}


function createShaderProgram(gl) {
  const vertexShaderSource = `#version 300 es
    precision highp float;

    uniform mat4 uTransformMatrix;
    uniform mat4 uProjectionMatrix;

    in vec3 aVertexPosition;
    // in vec3 aVertexColor;

    out vec4 vVertexColor;

    void main(void) {
      // vVertexColor = vec4(aVertexColor, 1.0);
      vVertexColor = vec4(0.0, 1.0, 0.0, 1.0);
      gl_Position = uProjectionMatrix * uTransformMatrix * vec4(aVertexPosition, 1.0);
    }
  `;

  const fragmentShaderSource = `#version 300 es
    precision highp float;

    in vec4 vVertexColor;
    out vec4 fragColor;

    void main(void) {
      fragColor = vVertexColor;
    }
  `;

  function compileShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    console.log(gl.getShaderInfoLog(shader));
    // gl.deleteShader(shader);
    return shader;
  }

  const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Could not initialize shaders');
  }

  program.aVertexPosition   = gl.getAttribLocation(program,  'aVertexPosition');
  // program.aVertexColor      = gl.getAttribLocation(program,  'aVertexColor');
  program.uTransformMatrix  = gl.getUniformLocation(program, 'uTransformMatrix');
  program.uProjectionMatrix = gl.getUniformLocation(program, 'uProjectionMatrix');

  gl.useProgram(program);
  return program;
}



// TODO Not sure how background color should work. 
// Typically you specify the background color in the css of the <div> that contans the canvas.
// Perhaps just clearing the texture with black-transparent is enough?
WGLp.render = function(options) {
  const r = this;
  // if(!r.ready) {
  //   console.log('gpu renderer initializing');
  //   return;
  // }
  console.log('webgl render');

  options = options || util.staticEmptyObject();

  /** @type {WebGLRenderingContext} gl */
  const gl = r.data.gl;
  const program = r.data.program;

  const eles = r.getCachedZSortedEles(); 

  const vertices = createVertexArrays(eles);
  const matrices = createMatrices(r);

  console.log('vertices', vertices);
  console.log('matrices', matrices);

  { // EDGES
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices.edgeVertexArray), gl.STATIC_DRAW);
    gl.vertexAttribPointer(program.aVertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.aVertexPosition);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.uniformMatrix4fv(program.uTransformMatrix,  false, matrices.transformMatrix);
    gl.uniformMatrix4fv(program.uProjectionMatrix, false, matrices.projectionMatrix);

    gl.drawArrays(gl.LINES, 0, vertices.edgeCount * 2);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
  }

  { // Nodes
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices.nodeVertexArray), gl.STATIC_DRAW);
    gl.vertexAttribPointer(program.aVertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.aVertexPosition);

    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.uniformMatrix4fv(program.uTransformMatrix,  false, matrices.transformMatrix);
    gl.uniformMatrix4fv(program.uProjectionMatrix, false, matrices.projectionMatrix);

    gl.drawArrays(gl.TRIANGLES, 0, vertices.nodeCount * 6);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
  }
};

export default WebGLRenderer;
