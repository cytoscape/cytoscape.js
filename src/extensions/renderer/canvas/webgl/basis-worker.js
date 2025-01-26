/* global self, BASIS */

export const MessageTo = {
  INIT: 'init',
  PING: 'ping',
  ENCODE: 'encode'
};

export const MessageFrom = {
  ENCODE_READY: 'encode_ready',
};


self.onmessage = (event) => {
  const { type } = event.data;
  switch(type) {
    case MessageTo.PING: {
      console.log('worker received a ping');
      break;
    }
    case MessageTo.INIT: {
      console.log('loading basis');
      const { jsUrl, wasmUrl } = event.data;
      loadBasis(jsUrl, wasmUrl)
        .then((result) => {
          console.log(result);
          self.postMessage({ message: "basis loaded" });
        });
      break;
    }
    case MessageTo.ENCODE: {
      console.log("encode: compress a texture!");
      const { buffer } = event.data;
      encode(buffer);
      break;
    }
    default: {
      console.log(`worker received unrecogized message type: ${type}`);
      break;
    }
  }
};


let basisPromise;

function loadBasis(jsUrl, wasmUrl) {
  if(!basisPromise) {
    self.importScripts(jsUrl);

    basisPromise = new Promise(resolve => {
      BASIS({ 
        locateFile: file => wasmUrl 
      })
      .then(module => {
        module.initializeBasis();
        resolve(module);
      });
    });
  }

  return basisPromise;
}

function getBasis() {
  if(!basisPromise)
    throw new Error('basis has not be initialized');
  return basisPromise;
}

/**
 * @param buffer Uint8Array containing PNG format
 */
function encode(pngBuffer) {
  getBasis()
  .then(basisModule => 
    encodePngToKTX2(basisModule, pngBuffer)
    .then(ktx2Buffer => encodeKTX2ToGPU(basisModule, ktx2Buffer))
    .then(texBuffer => {
      console.log("done encoding");
    })
    .catch(err => {
      console.log('in catch handler', err);
    })
  )
  .catch(err => {
    console.log('Error loading basis module.');
  });
}

/**
 * Notes:
 * - I think PNG is an LDR format.
 */
function encodePngToKTX2(basisModule, pngBuffer) {
  const { BasisEncoder } = basisModule;
 
  const imgType = basisModule.ldr_image_type.cPNGImage.value;
  const formatMode = basisModule.basis_tex_format.cUASTC4x4.value; // UASTC LDR 4x4, PNG is LDR, and UASTC looks better than ETC1S

  const basisEncoder = new BasisEncoder();
  basisEncoder.setDebug(true);
  basisEncoder.setCreateKTX2File(true);
  basisEncoder.setKTX2UASTCSupercompression(true);
  basisEncoder.setKTX2SRGBTransferFunc(true);
  basisEncoder.setSliceSourceImage(0, new Uint8Array(pngBuffer), 0, 0, imgType);
  basisEncoder.setFormatMode(formatMode);
  basisEncoder.setRDOUASTC(false);
  basisEncoder.setMipGen(true);
  basisEncoder.setPackUASTCFlags(1); // range [0, 3], lower is much faster

  const startTime = performance.now(); // eslint-disable-line no-undef

  // ENCODE!
  const ktx2FileData = new Uint8Array(pngBuffer.byteLength);  // TODO How to know what size buffer to use? Assuming it has to be less than the PNG format.
  const numOutputBytes = basisEncoder.encode(ktx2FileData);

  const elapsed = performance.now() - startTime; // eslint-disable-line no-undef
  console.log('encoding time', elapsed.toFixed(2));

  const actualKTX2FileData = new Uint8Array(ktx2FileData.buffer, 0, numOutputBytes);

  basisEncoder.delete();

  if (numOutputBytes == 0) {
    console.log('encodeBasisTexture() failed!');
    return Promise.reject(new Error('encoding png to ktx2 failed'));
  } else {
    console.log('encodeBasisTexture() succeeded, output size ' + numOutputBytes);
  }

  return Promise.resolve(actualKTX2FileData);
}

function encodeKTX2ToGPU(module, ktx2Buffer) {

}
