import type { Core } from './core-types.mjs';

/** Options accepted by the image export methods (`png`/`jpg`/`jpeg`). */
export interface ExportOptions {
  bg?: string;
  full?: boolean;
  scale?: number;
  maxWidth?: number;
  maxHeight?: number;
  [key: string]: unknown;
}

export interface ExportStringOptions extends ExportOptions {
  output?: 'base64uri' | 'base64';
}

export interface ExportBlobOptions extends ExportOptions {
  output: 'blob';
}

export interface ExportBlobPromiseOptions extends ExportOptions {
  output: 'blob-promise';
}

export interface ExportJpgOptions extends ExportOptions {
  quality?: number;
}

export interface ExportJpgStringOptions extends ExportJpgOptions, ExportStringOptions {}
export interface ExportJpgBlobOptions extends ExportJpgOptions, ExportBlobOptions {}
export interface ExportJpgBlobPromiseOptions extends ExportJpgOptions, ExportBlobPromiseOptions {}

/** Structural view of the renderer's image-export methods. */
interface ExportRenderer {
  png( options: ExportOptions ): string | Blob | Promise<Blob>;
  jpg( options: ExportOptions ): string | Blob | Promise<Blob>;
}

let corefn = ({

  png: function( this: Core, options?: ExportOptions ){
    let renderer = this._private.renderer as unknown as ExportRenderer;
    options = options || {};

    return renderer.png( options );
  },

  jpg: function( this: Core, options?: ExportOptions ){
    let renderer = this._private.renderer as unknown as ExportRenderer;
    options = options || {};

    options.bg = options.bg || '#fff';

    return renderer.jpg( options );
  }

}) as CoreExport;

corefn.jpeg = corefn.jpg;

/** Image export methods contributed to the core prototype. */
export interface CoreExport {
  png( this: Core, options?: ExportStringOptions ): string;
  png( this: Core, options?: ExportBlobOptions ): Blob;
  png( this: Core, options?: ExportBlobPromiseOptions ): Promise<Blob>;
  jpg( this: Core, options?: ExportJpgStringOptions ): string;
  jpg( this: Core, options?: ExportJpgBlobOptions ): Blob;
  jpg( this: Core, options?: ExportJpgBlobPromiseOptions ): Promise<Blob>;
  jpeg( this: Core, options?: ExportJpgStringOptions ): string;
  jpeg( this: Core, options?: ExportJpgBlobOptions ): Blob;
  jpeg( this: Core, options?: ExportJpgBlobPromiseOptions ): Promise<Blob>;
}

export default corefn as CoreExport;
