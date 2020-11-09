var fs= require('fs');
var path = require('path');

var mdFiles = {
    "ani" : [],
    "collection" : [],
    "cy" : []
}
const directoryPath = path.join(__dirname, 'md');           
for( var x in mdFiles )
{
    var sub_folders = path.join(directoryPath, x);
    fs.readdirSync(sub_folders).forEach(file => {
        mdFiles[x].push(file);
        });
}

// if(mdFiles[cy].indexOf("add.md"))
console.log(mdFiles["cy"].indexOf("animateq.md"));
