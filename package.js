var packageJson = JSON.parse(Npm.require("fs").readFileSync('package.json'));

Package.describe({
  name: 'cytoscape:cytoscape',
  version: packageJson.version,
  summary: packageJson.description,
  git: packageJson.repository.url,
  documentation: 'README.md'
});

Package.onUse(function(api) {
  //api.versionsFrom('1.0');
  api.export('cytoscape');
  api.addFiles([
    'dist/cytoscape.js',
    'export.js'
  ]);
});

Package.onTest(function(api) {
  api.use('cytoscape:cytoscape');
  api.use('tinytest');
  api.addFiles('test-meteor.js');
});
