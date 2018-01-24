module.exports = {
  logLevel: 'silent',
  port: 3000,
  server: {
    baseDir: './',
    directory: true
  },
  ui: false,
  files: [ 'build/*', "debug/**" ],
  ghostMode: false,
  notify: false
};
