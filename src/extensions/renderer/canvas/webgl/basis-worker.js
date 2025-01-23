/* global self, BASIS */

export const MessageType = {
  INIT: 'init',
  PING: 'ping',
  ENCODE: 'encode'
};

self.onmessage = (event) => {
  const { type } = event.data;
  switch(type) {
    case 'ping': {
      console.log('worker received a ping');
      break;
    }
    case 'init': {
      console.log('loading basis');
      const { jsUrl, wasmUrl } = event.data;
      loadBasis(jsUrl, wasmUrl)
        .then((result) => {
          console.log(result);
          self.postMessage({ message: "basis loaded" });
        });
      break;
    }
    case 'encode': {
      console.log("encode: compress a texture!");
      const { pngBlob } = event.data;
      encode(pngBlob);
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


function encode(pngBlob) {
  getBasis()
  .then((module => {
    const { BasisEncoder, /*BasisFile, encodeBasisTexture*/ } = module;
    const basisEncoder = new BasisEncoder();
    console.log('basisEncoder', basisEncoder);
  }));
}