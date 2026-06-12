import type { Core } from './core-types.mjs';

/** Options accepted by the image export methods (`png`/`jpg`/`jpeg`). */
export interface ExportOptions {
  output?: 'base64uri' | 'base64' | 'blob' | 'blob-promise';
  bg?: string;
  full?: boolean;
  scale?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  [key: string]: unknown;
}

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
  png( this: Core, options?: ExportOptions ): string | Blob | Promise<Blob>;
  jpg( this: Core, options?: ExportOptions ): string | Blob | Promise<Blob>;
  jpeg( this: Core, options?: ExportOptions ): string | Blob | Promise<Blob>;
}

export default corefn as CoreExport;
