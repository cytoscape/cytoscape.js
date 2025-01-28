/* global self, BASIS */

export const MessageTo = {
  PING: 'PING',
  INIT: 'INIT',
  ENCODE: 'ENCODE'
};

export const MessageFrom = {
  INIT_COMPLETE: 'INIT_COMPLETE',
  ENCODE_COMPLETE: 'ENCODE_COMPLETE'
};


self.onmessage = (event) => {
  const { type } = event.data;
  switch(type) {
    case MessageTo.PING: {
      console.log('basis-worker: received a ping');
      break;
    }
    case MessageTo.INIT: {
      console.log('basis-worker: loading basis');
      const { jsUrl, wasmUrl, flags } = event.data;
      loadBasisModule(jsUrl, wasmUrl, flags)
        .then((result) => {
          self.postMessage({ type: MessageFrom.INIT_COMPLETE, message: "basis loaded" });
        });
      break;
    }
    case MessageTo.ENCODE: {
      console.log('basis-worker: got request to compress texture');
      const { buffer, tag } = event.data;
      encode(buffer, tag);
      break;
    }
    default: {
      console.log(`basis-worker: received unrecogized message type: '${type}'`);
      break;
    }
  }
};


let basisPromise;

function loadBasisModule(jsUrl, wasmUrl, flags) {
  if(!basisPromise) {
    self.importScripts(jsUrl);

    basisPromise = new Promise(resolve => {
      BASIS({ 
        locateFile: file => wasmUrl 
      })
      .then(basisModule => {
        basisModule.initializeBasis();
        basisModule.flags = flags;
        resolve(basisModule);
      });
    });
  }

  return basisPromise;
}

function getBasisModule() {
  if(!basisPromise)
    throw new Error('basis has not be initialized');
  return basisPromise;
}

/**
 * @param buffer Uint8Array containing PNG format
 */
function encode(pngBuffer, tag) {
  getBasisModule()
  .then(basisModule => 
    encodePngToKTX2(basisModule, pngBuffer)
    .then(ktx2 => encodeKTX2ToGPU(basisModule, ktx2))
    .then(result => {
      self.postMessage({ 
        type: MessageFrom.ENCODE_COMPLETE, 
        success: true, 
        tag,
        result,
      });
    })
    .catch(err => {
      self.postMessage({ 
        type: MessageFrom.ENCODE_COMPLETE, 
        success: false, 
        tag, 
        err 
      });
    })
  )
  .catch(err => {
    console.log('error initializing basis');
  });
}


/**
 */
function encodePngToKTX2(basisModule, pngBuffer) {
  const { BasisEncoder } = basisModule;
 
  const imgType = basisModule.ldr_image_type.cPNGImage.value;
  const formatMode = basisModule.basis_tex_format.cUASTC4x4.value; // UASTC LDR 4x4, PNG is LDR, and UASTC looks better than ETC1S

  const basisEncoder = new BasisEncoder();
  // basisEncoder.setDebug(true);
  basisEncoder.setCreateKTX2File(true);
  basisEncoder.setKTX2UASTCSupercompression(true);
  basisEncoder.setKTX2SRGBTransferFunc(true);
  basisEncoder.setSliceSourceImage(0, new Uint8Array(pngBuffer), 0, 0, imgType);
  basisEncoder.setFormatMode(formatMode);
  basisEncoder.setRDOUASTC(false);
  basisEncoder.setMipGen(true);

  // texture quality, range [0, 3], lower quality is faster to compress
  basisEncoder.setPackUASTCFlags(2);

  const startTime = performance.now(); // eslint-disable-line no-undef

  // ENCODE!
  const ktx2FileData = new Uint8Array(pngBuffer.byteLength);  // TODO How to know what size buffer to use? Assuming it has to be less than the PNG format.
  const numOutputBytes = basisEncoder.encode(ktx2FileData);

  const elapsed = performance.now() - startTime; // eslint-disable-line no-undef
  console.log('encoding time', elapsed.toFixed(2));

  const actualKTX2FileData = new Uint8Array(ktx2FileData.buffer, 0, numOutputBytes);

  basisEncoder.delete();

  if (numOutputBytes == 0) {
    return Promise.reject(new Error('encoding png to ktx2 failed'));
  }

  return Promise.resolve(actualKTX2FileData);
}

/**
 * Note: If the file is UASTC LDR, the preferred formats are ASTC/BC7
 */
function encodeKTX2ToGPU(basisModule, ktx2FileData) {
  const { KTX2File, flags } = basisModule;

  const ktx2File = new KTX2File(new Uint8Array(ktx2FileData));
  const width  = ktx2File.getWidth();
  const height = ktx2File.getHeight();

  try {
    if(!ktx2File.isValid()) {
      return Promise.reject(new Error('Invalid or unsupported .ktx2 file'));
    }
    if(!ktx2File.startTranscoding()) {
      return Promise.reject(new Error('startTranscoding failed'));
    }
  
    const format = getCompressionFormat(basisModule, flags);
    if(format === undefined) {
      return Promise.reject(new Error('no valid output format'));
    }

    const destSize = ktx2File.getImageTranscodedSizeInBytes(0, 0, 0, format.basis);
    const compressedData = new Uint8Array(destSize);
  
    const decodeFlags = basisModule.basisu_decode_flags.cDecodeFlagsHighQuality.value;
    const res = ktx2File.transcodeImageWithFlags(compressedData, 0, 0, 0, format.basis, decodeFlags, -1, -1);
    if(!res) {
      return Promise.reject(new Error('transcodeImage failed'));
    }

    return Promise.resolve({ 
      compressedData, 
      format: format.webgl, 
      width, 
      height 
    });

  } finally {
    ktx2File.close();
    ktx2File.delete();
  }
}


const webglFormat = {
  // https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_astc/
  COMPRESSED_RGBA_ASTC_4x4_KHR: 0x93B0,
  // https://www.khronos.org/registry/webgl/extensions/EXT_texture_compression_bptc/
  COMPRESSED_RGBA_BPTC_UNORM: 0x8E8C,
  // http://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_s3tc/
  COMPRESSED_RGBA_S3TC_DXT5_EXT: 0x83F3,
  // https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_etc1/
  COMPRESSED_RGB_ETC1_WEBGL: 0x8D64
};

/**
 * Note: we assume the texture has alpha
 * @see webgl-util.js getGPUTextureCompressionSupport
 */
function getCompressionFormat(basisModule, flags) {
  const basisFormat = basisModule.transcoder_texture_format;
  if(flags.astc) {
    return { 
      basis: basisFormat.cTFASTC_4x4_RGBA.value, 
      webgl: webglFormat.COMPRESSED_RGBA_ASTC_4x4_KHR 
    };
  } else if(flags.bc7) {
    return { 
      basis: basisFormat.cTFBC7_RGBA.value,
      webgl: webglFormat.COMPRESSED_RGBA_BPTC_UNORM 
    };
  } else if(flags.dxt) {
    return { 
      basis: basisFormat.cTFBC3_RGBA.value,
      webgl: webglFormat.COMPRESSED_RGBA_S3TC_DXT5_EXT 
    };
  // } else if((pvrtcSupported) && (!pvrtcDisabled) && (is_square_pow2)) {// TODO ?
  //   return format.cTFPVRTC1_4_RGBA;
  // }
  } else if(flags.etc) {
    return { 
      basis: basisFormat.cTFETC1_RGB.value,
      webgl: webglFormat.COMPRESSED_RGB_ETC1_WEBGL 
    };
  } else {
    return undefined;
    // return format.cTFRGB565; // uncompressed
  }
}