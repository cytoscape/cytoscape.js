const GPUp = GPURenderer.prototype;

function GPURenderer(options) {
  const r = this;
  r.ready = false;

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

  r.data = { 
    canvas,
    canvasContainer,
    needRedraw: {
      node: false,
      select: false,
    }
  };

  initDevice(canvas)
    .then(({ device, context, format }) => {
      r.data.device  = device;
      r.data.context = context;
      r.data.format  = format;
      r.ready = true;
      console.log('gpu renderer ready')
      r.redraw();
    });
}

async function initDevice(canvas) {
  if (!navigator.gpu) {
    throw new Error("WebGPU not supported on this browser.");
  }
  
  const adapter = await navigator.gpu.requestAdapter();  // TODO provide options that allow user to request certain adapter
  if (!adapter) {
    throw new Error("No appropriate GPUAdapter found.");
  }

  const device = await adapter.requestDevice();
  const format = navigator.gpu.getPreferredCanvasFormat(); // texture format

  /** @type GPUCanvasContext */
  const context = canvas.getContext('webgpu');
  context.configure({ device, format });

  return { device, context, format };
}


GPUp.redrawHint = function(group, bool) {
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


GPUp.matchCanvasSize = function(container) { // Resize canvas
  console.log('gpu matchCanvasSize');
  const r = this;

  // var pixelRatio = r.getPixelRatio(); // TODO pixel ratio??
  const pixelRatio = 1;

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

  r.canvasWidth  = canvasWidth;
  r.canvasHeight = canvasHeight;
};

GPUp.nodeShapeImpl = function(name, context, centerX, centerY, width, height, points, corners) {
};

GPUp.arrowShapeImpl = function(name) {
};

GPUp.renderTo = function(cxt, zoom, pan, pxRatio) {
  this.render({
    forcedContext: cxt,
    forcedZoom: zoom,
    forcedPan: pan,
    // drawAllLayers: true,
    forcedPxRatio: pxRatio
  });
};


function createVertexBuffers(eles, device) {
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

  function createFloatBuffer(array, label) {
    const floatArray = new Float32Array(array);

    const buffer = device.createBuffer({
      label: `${label} Vertex Buffer`,
      size: floatArray.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, floatArray);

    const bufferLayout = {
      arrayStride: 4 * 3, // 4 bytes * 3 dimensions
      attributes: [{
        format: 'float32x3',
        offset: 0,
        shaderLocation: 0, // see vertex shader
      }],
    };

    return [ buffer, bufferLayout ];
  }
  
  const [ nodeVertexBuffer, nodeVertexBufferLayout ] = createFloatBuffer(nodeVertexArray, 'Node');
  const [ edgeVertexBuffer, edgeVertexBufferLayout ] = createFloatBuffer(edgeVertexArray, 'Edge');
  
  return {
    nodeVertexBuffer,
    nodeVertexBufferLayout,
    nodeCount,
    nodeVertexCount: nodeCount * 6, // render two triangles per node
    edgeVertexBuffer,
    edgeVertexBufferLayout,
    edgeCount,
    edgeVertexCount: edgeCount * 2, // render lines
  }
}



function createMatrixBuffers(r, device) {

  function getTranslationScaleMatrix() {
    const zoom = r.cy.zoom();
    const pan  = r.cy.pan();
  
    const mat = new Array(16).fill(0);
    mat[0] = zoom;
    mat[5] = zoom;
    mat[10] = 1;
    mat[12] = pan.x;
    mat[13] = pan.y;
    mat[15] = 1;
    return mat;
  }

  function getOrthographicProjectionMatrix() {
    // maps the canvas space into webGPU clip space
    const width = r.canvasWidth;
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

  function createMatrixBuffer(matrix, label) {
    const floatArray = new Float32Array(matrix);
    const buffer = device.createBuffer({
      label: `${label} Matrix Buffer`,
      size: floatArray.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, floatArray);
    return buffer;
  }

  const translationMatrix = getTranslationScaleMatrix();
  const translationMatrixBuffer = createMatrixBuffer(translationMatrix, 'Translation');
  const projectionMatrix = getOrthographicProjectionMatrix();
  const projectionMatrixBuffer = createMatrixBuffer(projectionMatrix, 'Projection');

  return {
    translationMatrixBuffer,
    projectionMatrixBuffer
  };
}


function createNodeShaderPipeline(vertices, uniforms, device, format) {
  const module = device.createShaderModule({  // WGSL
    label: "Node shader",
    code: `
      @group(0) @binding(0) var<uniform> transformMatrix: mat4x4f;
      @group(0) @binding(1) var<uniform> projectionMatrix: mat4x4f;

      @vertex
      fn vertexMain(@location(0) pos: vec3f) -> @builtin(position) vec4f {
        return projectionMatrix * transformMatrix * vec4f(pos, 1);
      }

      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return vec4f(1, 0, 0, 1); // red
      }
    `
  });

  const pipeline = device.createRenderPipeline({
    label: "Node pipeline",
    layout: 'auto',
    vertex: {
      module,
      buffers: [ vertices.nodeVertexBufferLayout ]
    },
    fragment: {
      module,
      targets: [{ format }] // corresponds to @location(0) return value from fragment shader
    }
  });

  const bindGroup0 = device.createBindGroup({
    label: "Node Matrix bind group",
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniforms.translationMatrixBuffer }},
      { binding: 1, resource: { buffer: uniforms.projectionMatrixBuffer }},
    ],
  });

  return {
    pipeline,
    bindGroups: [ bindGroup0 ]
  };
}

// TODO This currenlty looks very similar to the Node pipeline, but I anticipate they will diverge greatly as features are added.
function createEdgeShaderPipeline(vertices, uniforms, device, format) {
  const module = device.createShaderModule({  // WGSL
    label: "Edge shader",
    code: `
      @group(0) @binding(0) var<uniform> transformMatrix: mat4x4f;
      @group(0) @binding(1) var<uniform> projectionMatrix: mat4x4f;

      @vertex
      fn vertexMain(@location(0) pos: vec3f) -> @builtin(position) vec4f {
        return projectionMatrix * transformMatrix * vec4f(pos, 1);
      }

      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return vec4f(0, 1, 0, 1); // green
      }
    `
  });

  const pipeline = device.createRenderPipeline({
    label: "Edge pipeline",
    layout: 'auto',
    primitive: { topology: 'line-list' },
    vertex: {
      module,
      buffers: [ vertices.edgeVertexBufferLayout ]
    },
    fragment: {
      module,
      targets: [{ format }] // corresponds to @location(0) return value from fragment shader
    }
  });

  const bindGroup0 = device.createBindGroup({
    label: "Edge Matrix bind group",
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniforms.translationMatrixBuffer }},
      { binding: 1, resource: { buffer: uniforms.projectionMatrixBuffer }},
    ],
  });

  return {
    pipeline,
    bindGroups: [ bindGroup0 ]
  };
}


// TODO Not sure how background color should work. 
// Typically you specify the background color in the css of the <div> that contans the canvas.
// Perhaps just clearing the texture with black-transparent is enough?
GPUp.render = function(options) {
  const r = this;
  if(!r.ready) {
    console.log('gpu renderer initializing');
    return;
  }
  console.log('gpu render');

  options = options || util.staticEmptyObject();
  const { device, context, format } = r.data;
  const texture = context.getCurrentTexture();

  const eles = r.getCachedZSortedEles(); 
  const vertices = createVertexBuffers(eles, device);
  const uniforms = createMatrixBuffers(r, device);
  const edgePipeline = createEdgeShaderPipeline(vertices, uniforms, device, format);
  const nodePipeline = createNodeShaderPipeline(vertices, uniforms, device, format);

  const commandEncoder = device.createCommandEncoder();
  
  const edgePass = commandEncoder.beginRenderPass({ 
    colorAttachments: [{
      view: texture.createView(),
      loadOp: 'clear',
      clearValue: { r: 0, g: 0, b: 0.6, a: 1 },
      storeOp: 'store'
    }]
  });
  edgePass.setPipeline(edgePipeline.pipeline);
  edgePass.setBindGroup(0, edgePipeline.bindGroups[0]);
  edgePass.setVertexBuffer(0, vertices.edgeVertexBuffer);
  edgePass.draw(vertices.edgeVertexCount); // drawing line-list
  edgePass.end();

  const nodePass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: 'load',
      storeOp: 'store'
    }]
  });
  nodePass.setPipeline(nodePipeline.pipeline);
  nodePass.setBindGroup(0, nodePipeline.bindGroups[0]);
  nodePass.setVertexBuffer(0, vertices.nodeVertexBuffer);
  nodePass.draw(vertices.nodeVertexCount);
  nodePass.end();

  const commandBuffer = commandEncoder.finish();
  device.queue.submit([commandBuffer]);
};

export default GPURenderer;
