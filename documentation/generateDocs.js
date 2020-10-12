var fs=require('fs');
var data=fs.readFileSync('docmaker.json', 'utf8');
var dockmaker_elements=JSON.parse(data);

const { exec } = require('child_process');
exec('jsdoc -X ../src/core/*.js > jsdocAST.json', (err, stdout, stderr) => {
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
sleepFor(2000)

var data_AST=fs.readFileSync('jsdocAST.json', 'utf8');
var words=JSON.parse(data_AST);

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
            
            args.descr = words[i].properties[j].description;
            types[words[i].name].push(args);
        }
    }
}
console.log(types);
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
            
            fns.push(func);
        }
    }
    
}

// save generated file
fs.writeFile ("jsdocAnnotations.json", JSON.stringify(fns, null, 4), function(err) {
    if (err) throw err;
    console.log('complete');
});

var mappings=fns;

for(var i in dockmaker_elements.sections)
{
    if(dockmaker_elements.sections[i].name != undefined && dockmaker_elements.sections[i].name == 'Core')
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
fs.writeFile ("docmaker.json", JSON.stringify(dockmaker_elements, null,4), function(err) {
    if (err) throw err;
    console.log('complete');
});
