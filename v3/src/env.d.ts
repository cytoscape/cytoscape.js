// `process.env.VERSION` and `process.env.NODE_ENV` are string-replaced at
// build time by @rollup/plugin-replace (see rolldown.config.mjs); Node's
// `process` global never actually exists in the browser bundles.
declare const process: {
  env: {
    VERSION: string;
    NODE_ENV: string;
  };
};
