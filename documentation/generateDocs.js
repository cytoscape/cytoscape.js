var fs= require('fs');
var path = require('path');
var data=fs.readFileSync( path.join(__dirname, './docmaker.json'), 'utf8');
var dockmaker_elements=JSON.parse(data);

const { exec } = require('child_process');
exec('jsdoc -X ./src/[c,d,e,u]*/*.js > ./documentation/AST/core_AST.json && jsdoc -X ./src/animation.js > ./documentation/AST/animation_AST.json && jsdoc -X ./src/extensions/layout/index.js > ./documentation/AST/layout_AST.json', { "shell": "/bin/bash" },(err, stdout, stderr) => {
  if (err) {
    //some err occurred
    console.error(err)
  } else {
   // the *entire* stdout and stderr (buffered)
   console.log(`stdout: ${stdout}`);
   console.log(`stderr: ${stderr}`);
  }
});

function sleepFor( sleepDuration ){
    var now = new Date().getTime();
    while(new Date().getTime() < now + sleepDuration){ /* do nothing */ } 
}
sleepFor(5000)

var core_AST=fs.readFileSync( path.join(__dirname, './AST/core_AST.json'), 'utf8');
var words=JSON.parse(core_AST);
var animation_AST=fs.readFileSync( path.join(__dirname, './AST/animation_AST.json'), 'utf8');
var animation_words=JSON.parse(animation_AST);
var layout_AST=fs.readFileSync( path.join(__dirname, './AST/layout_AST.json'), 'utf8');
var layout_words=JSON.parse(layout_AST);

for(var idx in animation_words)
{
    words.push(animation_words[idx]);
}

for(var idx in layout_words)
{
    words.push(layout_words[idx]);
}

fs.writeFile ( path.join(__dirname, "./jsdocAST.json"), JSON.stringify(words, null, 4), function(err) {
    if (err) throw err;
    console.log('complete');
});

var fns = [];

var types = {};

for(var i in words)
{
    delete words[i].meta;
    if(words[i].comment == "")
    {
        delete words.splice(i,1);
    }
}

for(var i in words)
{
    if(words[i].kind == 'typedef')
    {
        types[words[i].name] = [];
        for(var j in words[i].properties)
        {
            //defines arguments
            var args = {};
            
            //checking whether we have a callback function as an argument
            if(words[i].properties[j].type.names == 'function')
            {
                args.name = types[words[i].properties[j].name][0].name;

                args.fields = types[types[words[i].properties[j].name][0].descr];
                
            }
            else
            {
                args.name = words[i].properties[j].name;
            }
            
            // checking for optional parameters
            if(words[i].properties[j].description && words[i].properties[j].description.includes("[optional]"))
            {
                args.descr = words[i].properties[j].description.split("[optional] ")[1];
                args.optional = true;
            }
            else
            {
                args.descr = words[i].properties[j].description;
            }
            types[words[i].name].push(args);
        }
    }
}
// console.log(types);
for(var i in words)
{
    var func = {};
    if(words[i].undocumented == undefined)
    {
        if(words[i].memberof != undefined)
        {
            func.name = words[i].longname;

            if(words[i].alias != undefined)
            {
                func.pureAliases = words[i].alias.split("|");
            }

            // checking for formatSameFn
            if(words[i].tags != undefined && words[i].tags.find(fn => fn.originalTitle == "formatsSameFn") != undefined)
            {
                func.formatsSameFn = words[i].tags.find(fn => fn.originalTitle == "formatsSameFn").value;
            }

            // checking for extFn
            if(words[i].tags != undefined && words[i].tags.find(fn => fn.originalTitle == "extFn") != undefined)
            {
                func.extFn = words[i].tags.find(fn => fn.originalTitle == "extFn").value;
            }

            func.descr = words[i].description;
            func.formats = [];
            
            if(words[i].params != undefined)
            {
                var descr = words[i].params[0].description.split(" | ");
                for( var j in descr)
                {
                    // formats child
                    var temp = {};

                    if( words[i].tags != undefined )
                    {
                        var sub_names = words[i].tags.find(fn => fn.title == "sub_functions")
                        
                        if(sub_names != undefined)
                        {
                            var arr = sub_names.value.split("|");
                            temp.name = arr[j];
                        }
                    }

                    if( descr[j] != undefined )
                    {
                        temp.descr = descr[j];
                    } 
                    // console.log(descr[j]);
                    if(types[words[i].params[0].type.names[0]][j] != undefined)
                    {
                        if( types[words[i].params[0].type.names[0]][j].name != 'NULL' )
                        {
                            temp.args = [];

                            // Check for multiple arguments
                            if( types[types[words[i].params[0].type.names[0]][j].name] != undefined )
                            {
                                temp.args = types[types[words[i].params[0].type.names[0]][j].name];
                            }
                            else
                            {
                                temp.args.push(types[words[i].params[0].type.names[0]][j]);
                            }
                        }
                    }
                    // console.log(types[words[i].params[0].type.names[0]][j]);
                    func.formats.push(temp);
                }
            }
            else if (words[i].tags != undefined && words[i].tags.find(fn => fn.originalTitle == "param_desc") != undefined)
            {
            var val = words[i].tags.find(fn => fn.originalTitle == "param_desc");
            var arr = {};
            arr.descr = val.value;
            func.formats.push(arr);
            }
            else
            {
                delete func["formats"];
            }

            // check for md files
            var mdFiles = {
                "ani" : [],
                "collection" : [],
                "cy" : [],
                "layout": []
            }
            const directoryPath = path.join(__dirname, 'md');           
            for( var x in mdFiles )
            {
                var sub_folders = path.join(directoryPath, x);
                fs.readdirSync(sub_folders).forEach(file => {
                    mdFiles[x].push(file);
                  });
            }
            var search_md_file = words[i].longname.split(".")[1] + '.md';
            // checking md files inside core
            if(words[i].longname.split(".")[0] == "cy")
            {
                if(mdFiles["cy"].indexOf(search_md_file) != -1)
                {
                    func.md = "cy/" + words[i].longname.split(".")[1];
                }
            }
            // checking md files inside animation
            else if(words[i].longname.split(".")[0] == "ani")
            {
                if(mdFiles["ani"].indexOf(search_md_file) != -1)
                {
                    func.md = "ani/" + words[i].longname.split(".")[1];
                }
            }
            // checking md files inside layout
            else if(words[i].longname.split(".")[0] == "layout")
            {
                if(mdFiles["layout"].indexOf(search_md_file) != -1)
                {
                    func.md = "layout/" + words[i].longname.split(".")[1];
                }
            }
            // checking md files inside collection
            else
            {
                if(mdFiles["collection"].indexOf(search_md_file) != -1)
                {
                    func.md = "collection/" + words[i].longname.split(".")[1];
                }
            }
            
            fns.push(func);
        }
    }
    
}

// save generated file
fs.writeFile ( path.join(__dirname, "./jsdocAnnotations.json"), JSON.stringify(fns, null, 4), function(err) {
    if (err) throw err;
    console.log('complete');
});

var mappings=fns;

for(var i in dockmaker_elements.sections)
{
    if(dockmaker_elements.sections[i].name != undefined && ( dockmaker_elements.sections[i].name == 'Core' || dockmaker_elements.sections[i].name == 'Collection' || dockmaker_elements.sections[i].name == 'Animations' || dockmaker_elements.sections[i].name == 'Layouts' ))
    {
        for( var j in dockmaker_elements.sections[i].sections)
        {
            if(dockmaker_elements.sections[i].sections[j].fns != undefined)
            {
                for( var k in dockmaker_elements.sections[i].sections[j].fns)
                {
                    for( var x in mappings )
                    {
                        if(dockmaker_elements.sections[i].sections[j].fns[k].name == mappings[x].name)
                        {
                            dockmaker_elements.sections[i].sections[j].fns[k] = mappings[x];
                            break;
                        }
                    }
                }
            }
        }
    }
}

// save generated file
fs.writeFile ( path.join(__dirname, "./docmaker.json"), JSON.stringify(dockmaker_elements, null,4), function(err) {
    if (err) throw err;
    console.log('complete');
});

