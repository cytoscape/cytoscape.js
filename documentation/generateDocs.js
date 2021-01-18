var fs= require('fs');
var path = require('path');
var data=fs.readFileSync( path.join(__dirname, './docmaker.json'), 'utf8');
var dockmaker_elements=JSON.parse(data);

var core_AST=fs.readFileSync( path.join(__dirname, './ast/core_AST.json'), 'utf8');
var words=JSON.parse(core_AST);
var collection_AST=fs.readFileSync( path.join(__dirname, './ast/collection_AST.json'), 'utf8');
var collection_words=JSON.parse(collection_AST);
var animation_AST=fs.readFileSync( path.join(__dirname, './ast/animation_AST.json'), 'utf8');
var animation_words=JSON.parse(animation_AST);
var layout_AST=fs.readFileSync( path.join(__dirname, './ast/layout_AST.json'), 'utf8');
var layout_words=JSON.parse(layout_AST);

for(var idx in collection_words)
{
    words.push(collection_words[idx]);
}

for(var idx in animation_words)
{
    words.push(animation_words[idx]);
}

for(var idx in layout_words)
{
    words.push(layout_words[idx]);
}

fs.writeFileSync( path.join(__dirname, "./jsdocAST.json"), JSON.stringify(words, null, 4), function(err) {
    if (err) throw err;
    console.log('complete');
});

var fns = [];

var types = {};

var functionPath = {};

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
            
            // checking for pureAliases
            if(words[i].tags != undefined && words[i].tags.find(fn => fn.originalTitle == "pureAliases") != undefined)
            {
                func.pureAliases = words[i].tags.find(fn => fn.originalTitle == "pureAliases").value.split("|");
            }

            // checking for methodName
            if(words[i].tags != undefined && words[i].tags.find(fn => fn.originalTitle == "methodName") != undefined)
            {
                func.name = words[i].tags.find(fn => fn.originalTitle == "methodName").value;
            }

            // checking for formatSameFn
            if(words[i].tags != undefined && words[i].tags.find(fn => fn.originalTitle == "formatsSameFn") != undefined)
            {
                func.formatsSameFn = words[i].tags.find(fn => fn.originalTitle == "formatsSameFn").value;
            }

            // checking for extFn
            if(words[i].tags != undefined && words[i].tags.find(fn => fn.originalTitle == "extFn") != undefined)
            {
                func.extFn = true;
            }

            // mapping fuution with path
            if(words[i].tags != undefined && words[i].tags.find(fn => fn.originalTitle == "path") != undefined)
            {
                functionPath[func.name] = words[i].tags.find(fn => fn.originalTitle == "path").value;
            }

            func.descr = words[i].description;
            func.formats = [];
            
            if(words[i].params != undefined && words[i].params[0] != undefined)
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

                    if( descr[j] != undefined && descr[j] != "NULL" )
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
            var search_md_file = func.name.split(".")[1] + '.md';
            // checking md files inside core
            if(func.name.split(".")[0] == "cy")
            {
                if(mdFiles["cy"].indexOf(search_md_file) != -1)
                {
                    func.md = "cy/" + func.name.split(".")[1];
                }
            }
            // checking md files inside animation
            else if(func.name.split(".")[0] == "ani")
            {
                if(mdFiles["ani"].indexOf(search_md_file) != -1)
                {
                    func.md = "ani/" + func.name.split(".")[1];
                }
            }
            // checking md files inside layout
            else if(func.name.split(".")[0] == "layout")
            {
                if(mdFiles["layout"].indexOf(search_md_file) != -1)
                {
                    func.md = "layout/" + func.name.split(".")[1];
                }
            }
            // checking md files inside collection
            else
            {
                if(mdFiles["collection"].indexOf(search_md_file) != -1)
                {
                    func.md = "collection/" + func.name.split(".")[1];
                }
            }
            
            fns.push(func);
        }
    }
    
}

// save generated file
fs.writeFileSync( path.join(__dirname, "./jsdocAnnotations.json"), JSON.stringify(fns, null, 4), function(err) {
    if (err) throw err;
    console.log('complete');
});

for(var i in fns)
{
    var flag = true;
    if(functionPath[fns[i].name] != undefined)
    {
        for(var a in dockmaker_elements.sections)
        {
            if(dockmaker_elements.sections[a].name == functionPath[fns[i].name].split("/")[0])
            {
                for(var b in dockmaker_elements.sections[a].sections)
                {
                    if(dockmaker_elements.sections[a].sections[b].name == functionPath[fns[i].name].split("/")[1])
                    {
                        for(var c in dockmaker_elements.sections[a].sections[b].fns)
                        {
                            if(dockmaker_elements.sections[a].sections[b].fns[c].name == fns[i].name)
                            {
                                dockmaker_elements.sections[a].sections[b].fns[c] = fns[i];
                                flag = false;
                                break;
                            }                         
                        }
                    }
                }
            }
        }
        if(flag)
        {
            for(var a in dockmaker_elements.sections)
            {
                if(dockmaker_elements.sections[a].name == functionPath[fns[i].name].split("/")[0])
                {
                    for(var b in dockmaker_elements.sections[a].sections)
                    {
                        if(dockmaker_elements.sections[a].sections[b].name == functionPath[fns[i].name].split("/")[1])
                        {
                            dockmaker_elements.sections[a].sections[b].fns.push(fns[i]);
                        }
                    }
                }
            }
        }
    }
}


for(var i in fns)
{
    console.log(fns[i].name.split(".")[0]);
    fs.writeFileSync( path.join(__dirname + "/fn-json/" + fns[i].name.split(".")[0] , "./" + fns[i].name.split(".")[1] + ".json"), JSON.stringify(fns[i], null,4), function(err) {
    if (err) throw err;
    console.log('complete');
    });
}

// save generated file
fs.writeFileSync( path.join(__dirname, "./docmaker.json"), JSON.stringify(dockmaker_elements, null,4), function(err) {
    if (err) throw err;
    console.log('complete');
});

