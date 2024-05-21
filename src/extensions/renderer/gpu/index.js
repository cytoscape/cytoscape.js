const GPUp = GPURenderer.prototype;

function GPURenderer(options) {
  console.log('GPURenderer constructor');
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


function createNodeVertexBuffer(eles, device, shaderLocation = 0) {
  const vertexArray = [];
  let nodeCount = 0;
  let z = 0; // A f32 can exactly represent integer values in the range [−16777216, 16777216]

  // TODO need to add Z coord so that ordering is correct?
  // Or maybe just drawing them in order will do the trick?
  // No,,, vertex shaders run in parallel
  for(let i = 0; i < eles.length; i++) {
    const ele = eles[i];
    if(!ele.isNode())
      continue;

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
    // const [ topY, botY, leftX, rightX ] = [ 0.8, -0.8, -0.8, 0.8 ];

    // 6 vertices per node (for now)
    vertexArray.push(
      leftX, botY, z,
      rightX, botY, z,
      rightX, topY, z,

      leftX, botY, z,
      rightX, topY, z,
      leftX, topY, z
    );

    nodeCount++;
    // z++;
  }

  const vertexFloatArray = new Float32Array(vertexArray);
  const vertexBuffer = device.createBuffer({
    label: "Node vertices",
    size: vertexFloatArray.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexFloatArray);

  const vertexBufferLayout = {
    arrayStride: 4 * 3, // 4 bytes * 3 dimensions
    attributes: [{
      format: 'float32x3',
      offset: 0,
      shaderLocation, // Position, see vertex shader
    }],
  };

  return {
    vertexBuffer,
    vertexBufferLayout,
    nodeCount,
    vertexCount: nodeCount * 6
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

  const translationMatrix = getTranslationScaleMatrix();
  const translationMatrixArray = new Float32Array(translationMatrix);
  const translationMatrixBuffer = device.createBuffer({
    label: "Translation Matrix",
    size: translationMatrixArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(translationMatrixBuffer, 0, translationMatrixArray);

  const projectionMatrix = getOrthographicProjectionMatrix();
  const projectionMatrixArray = new Float32Array(projectionMatrix);
  const projectionMatrixBuffer = device.createBuffer({
    label: "Projection Matrix",
    size: projectionMatrixArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(projectionMatrixBuffer, 0, projectionMatrixArray);

  console.log('translationMatrix', translationMatrix);
  console.log('projectionMatrix', projectionMatrix);

  return {
    translationMatrixBuffer,
    projectionMatrixBuffer
  };
}


function createShaderPipeline(vertices, uniforms, device, format) {
  const module = device.createShaderModule({  // WGSL
    label: "Node shader",
    code: `
      @group(0) @binding(0) var<uniform> transformMatrix: mat4x4f;
      @group(0) @binding(1) var<uniform> projectionMatrix: mat4x4f;

      @vertex
      fn vertexMain(
        @location(0) pos: vec3f,
      ) -> 
        @builtin(position) vec4f 
      {
        return projectionMatrix * transformMatrix * vec4f(pos, 1);
      }

      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return vec4f(1, 0, 0, 1); // for now just return red
      }
    `
  });

  const pipeline = device.createRenderPipeline({
    label: "Node pipeline",
    layout: 'auto',
    vertex: {
      module,
      buffers: [ vertices.vertexBufferLayout ]
    },
    fragment: {
      module,
      targets: [{ format }] // corresponds to @location(0) return value from fragment shader
    }
  });

  const bindGroup0 = device.createBindGroup({
    label: "Matrix bind group",
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




GPUp.render = function(options) {
  const r = this;
  if(!r.ready) {
    console.log('gpu renderer initializing');
    return;
  }
  console.log('gpu render');

  options = options || util.staticEmptyObject();
  const eles = r.getCachedZSortedEles(); // normal array

  const { device, context, format } = r.data;

  // buffer that holds verticies for node squares
  const vertices = createNodeVertexBuffer(eles, device, 0);
  const uniforms = createMatrixBuffers(r, device);
  const pipeline = createShaderPipeline(vertices, uniforms, device, format);

  const commandEncoder = device.createCommandEncoder();

  // TODO Not sure how background color should work. 
  // Typically you specify the background color in the css of the <div> that contans the canvas.
  // Perhaps just clearing the texture with black-transparent is enough?
  const pass = commandEncoder.beginRenderPass({  // This argument is a GPURenderPassDescriptor
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: 'clear',
      clearValue: { r: 0, g: 0, b: 0.6, a: 1 },
      storeOp: 'store'
    }]
  });
  pass.setPipeline(pipeline.pipeline);
  pass.setBindGroup(0, pipeline.bindGroups[0]);
  pass.setVertexBuffer(0, vertices.vertexBuffer);
  pass.draw(vertices.vertexCount);
  pass.end();

  console.log(`Drawing ${vertices.nodeCount} nodes`);

  const commandBuffer = commandEncoder.finish();
  device.queue.submit([commandBuffer]);
};

export default GPURenderer;
