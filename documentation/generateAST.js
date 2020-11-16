var fs= require('fs');
var path = require('path');
var data=fs.readFileSync( path.join(__dirname, './docmaker.json'), 'utf8');

const { exec } = require('child_process');
exec('jsdoc -X ./src/[c,e,u]*/*.js > ./documentation/AST/core_AST.json && jsdoc -X ./src/animation.js > ./documentation/AST/animation_AST.json && jsdoc -X ./src/extensions/layout/index.js > ./documentation/AST/layout_AST.json', { "shell": "/bin/bash" },(err, stdout, stderr) => {
  if (err) {
    //some err occurred
    console.error(err)
  } else {
   // the *entire* stdout and stderr (buffered)
   console.log(`stdout: ${stdout}`);
   console.log(`stderr: ${stderr}`);
  }
});