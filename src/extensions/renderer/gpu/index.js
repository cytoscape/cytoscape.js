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
    canvasContainer
  };

  initDevice(canvas)
    .then(({ device, context, format }) => {
      r.data.device = device;
      r.data.context = context;
      r.data.format = format;
    })
    .then(() => {
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

GPUp.render = function(options) {
  if(!this.ready) {
    console.log('gpu renderer initializing');
    return;
  }
  console.log('gpu render');

  const { device, context } = this.data;
  const texture = context.getCurrentTexture();
  const commandEncoder = device.createCommandEncoder();

  // TODO Not sure how background color should work. 
  // Typically you specify the background color in the css of the <div> that contans the canvas.
  // Perhaps just clearing the texture is enough?
  const pass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: texture.createView(),
      loadOp: 'clear',
      clearValue: { r: 0, g: 0, b: 0.4, a: 1 },
      storeOp: 'store'
    }]
  });
  pass.end();

  const commandBuffer = commandEncoder.finish();
  device.queue.submit([commandBuffer]);
};

export default GPURenderer;
