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

    // 6 vertices per node (for now)
    vertexArray.push(
    //   leftX, botY,
    //   rightX, botY,
    //   rightX, topY,
    //   leftX, botY,
    //   rightX, topY,
    //   leftX, topY

        // X,    Y,
        -0.8, -0.8, // Triangle 1
        0.8, -0.8,
        0.8,  0.8,
     
       -0.8, -0.8, // Triangle 2
        0.8,  0.8,
       -0.8,  0.8,
    );

    nodeCount++;
  }

  const vertexFloatArray = new Float32Array(vertexArray);
  const vertexBuffer = device.createBuffer({
    label: "Node vertices",
    size: vertexFloatArray.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexFloatArray);

  const vertexBufferLayout = {
    arrayStride: 4 * 2, // 4 bytes * 2 dimensions
    attributes: [{
      format: 'float32x2',
      offset: 0,
      shaderLocation, // Position, see vertex shader
    }],
  };

  return {
    vertexArray, // TEMP remove to allow to be garbage collected
    vertexBuffer,
    vertexBufferLayout,
    nodeCount,
    vertexCount: nodeCount * 6
  }
}


function createShaderModule(vertices, device, format) {
  const shaderModule = device.createShaderModule({  // WGSL
    label: "Node shader",
    code: `
      @vertex
      fn vertexMain(
        @location(0) pos: vec2f,
      ) -> 
        @builtin(position) vec4f 
      {
        return vec4f(pos, 0, 1);
      }

      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return vec4f(1, 0, 0, 1); // for now just return red
      }
    `
  });

  // TODO pipelineLayout and vertexBufferLayout???
  const pipeline = device.createRenderPipeline({
    label: "Node pipeline",
    layout: 'auto', // pipelineLayout, // TODO could also be 'auto'
    vertex: {
      module: shaderModule,
      entryPoint: "vertexMain",
      buffers: [ vertices.vertexBufferLayout ]
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragmentMain",
      targets: [{ format }] // corresponds to @location(0) return value from fragment shader
    }
  });

  return {
    pipeline
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
  const shaders = createShaderModule(vertices, device, format);

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
  pass.setPipeline(shaders.pipeline);
  pass.setVertexBuffer(0, vertices.vertexBuffer);
  pass.draw(vertices.vertexCount);
  pass.end();

  console.log(`Drawing ${vertices.nodeCount} nodes`);
  console.log(vertices.vertexArray);

  const commandBuffer = commandEncoder.finish();
  device.queue.submit([commandBuffer]);
};

export default GPURenderer;
