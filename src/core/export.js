let corefn = ({

      /**
 * @callback png_options
 * @property {png_options_type} options - png_options_type
 */

/**
 * options
 * @typedef {object} png_options_type
 * @property {object} output - Whether the output should be `'base64uri'` (default), `'base64'`, `'blob'`, or `'blob-promise'` (a promise that resolves to the blob is returned).
 * @property {object} bg - The background colour of the image (transparent by default).
 * @property {object} full - Whether to export the current viewport view (`false`, default) or the entire graph (`true`).
 * @property {object} scale - This value specifies a positive number that scales the size of the resultant image.
 * @property {object} maxWidth - Specifies the scale automatically in combination with `maxHeight` such that the resultant image is no wider than `maxWidth`.
 * @property {object} maxHeight - Specifies the scale automatically in combination with `maxWidth` such that the resultant image is no taller than `maxHeight`.
 */

/**
 * @typedef {object} cy_png
 * @property {function(png_options):any} png_options - The export options
 */

  /**
 * Export the current graph view as a PNG image.
 * @memberof cy
 * @path Collection/Export
 * @param {...cy_png} options - NULL
 * @methodName cy.png
 */
  png: function( options ){
    let renderer = this._private.renderer;
    options = options || {};

    return renderer.png( options );
  },
      /**
 * @callback jpg_options
 * @property {jpg_options_type} options - jpg_options_type
 */

/**
 * options
 * @typedef {object} jpg_options_type
 * @property {object} output - Whether the output should be `'base64uri'` (default), `'base64'`, `'blob'`, or `'blob-promise'` (a promise that resolves to the blob is returned).
 * @property {object} bg - The background colour of the image (transparent by default).
 * @property {object} full - Whether to export the current viewport view (`false`, default) or the entire graph (`true`).
 * @property {object} scale - This value specifies a positive number that scales the size of the resultant image.
 * @property {object} maxWidth - Specifies the scale automatically in combination with `maxHeight` such that the resultant image is no wider than `maxWidth`.
 * @property {object} maxHeight - Specifies the scale automatically in combination with `maxWidth` such that the resultant image is no taller than `maxHeight`.
 * @property {object} quality - Specifies the quality of the image from `0` (low quality, low filesize) to `1` (high quality, high filesize). If not set, the browser's default quality value is used
 */

/**
 * @typedef {object} cy_jpg
 * @property {function(jpg_options):any} jpg_options - The export options
 */

  /**
 * Export the current graph view as a jpg image.
 * @memberof cy
 * @path Collection/Export
 * @pureAliases cy.jpeg
 * @param {...cy_jpg} options - NULL
 * @methodName cy.jpg
 */
  jpg: function( options ){
    let renderer = this._private.renderer;
    options = options || {};

    options.bg = options.bg || '#fff';

    return renderer.jpg( options );
  }

});

corefn.jpeg = corefn.jpg;

export default corefn;
