const ts = require('typescript');
const fs = require('fs');
const path = require('path');

// Load and parse the TypeScript definition file from node_modules
const fileName = path.resolve(__dirname, '..', 'node_modules', '@types', 'cytoscape', 'index.d.ts');
const sourceFile = ts.createSourceFile(
    fileName,
    fs.readFileSync(fileName, 'utf8'),
    ts.ScriptTarget.Latest,
    true
);

// Helper function to recursively extract function names
function extractFunctions(node, parentName = '') {
    let functions = [];

    function getQualifiedName(name) {
        return parentName ? `${parentName}.${name}` : name;
    }

    if (ts.isInterfaceDeclaration(node) || ts.isModuleDeclaration(node)) {
        const name = node.name.text;
        ts.forEachChild(node, child => {
            functions = functions.concat(extractFunctions(child, getQualifiedName(name)));
        });
    } else if (ts.isMethodSignature(node) || (ts.isPropertySignature(node) && ts.isFunctionTypeNode(node.type))) {
        const name = node.name.text;
        functions.push(getQualifiedName(name));
    } else {
        ts.forEachChild(node, child => {
            functions = functions.concat(extractFunctions(child, parentName));
        });
    }

    return functions;
}

// Extract functions from the source file
const functions = extractFunctions(sourceFile);

// Filter out options and results entries
const filteredFunctions = functions.filter(fn => {
    return !fn.includes('Options') && !fn.includes('Result');
});

// Format the function names according to the API documentation style
const formattedFunctions = filteredFunctions.map(fn => {
    if (fn.startsWith('cytoscape.Core')) {
        return 'cy.' + fn.split('.').slice(2).join('.');
    } else if (fn.startsWith('cytoscape.Collection')) {
        return 'eles.' + fn.split('.').slice(2).join('.');
    } else if (fn.startsWith('cytoscape.Singular')) {
        return 'ele.' + fn.split('.').slice(2).join('.');
    } else if (fn.startsWith('cytoscape.EdgeSingular')) {
        return 'edge.' + fn.split('.').slice(2).join('.');
    } else if (fn.startsWith('cytoscape.EdgeCollection')) {
        return 'edges.' + fn.split('.').slice(2).join('.');
    } else if (fn.startsWith('cytoscape.NodeSingular')) {
        return 'node.' + fn.split('.').slice(2).join('.');
    } else if (fn.startsWith('cytoscape.NodeCollection')) {
        return 'nodes.' + fn.split('.').slice(2).join('.');
    } else if (fn.startsWith('cytoscape.AbstractEventObject')) {
        return 'event.' + fn.split('.').slice(2).join('.');
    } else if (fn.startsWith('cytoscape.LayoutManipulation') || fn.startsWith('cytoscape.LayoutEvents')) {
        return 'layout.' + fn.split('.').slice(2).join('.');
    } else if (fn.startsWith('cytoscape.AnimationManipulation')) {
        return 'ani.' + fn.split('.').slice(2).join('.');
    } else if (fn.startsWith('cytoscape.Style')) {
        return 'style.' + fn.split('.').slice(2).join('.');
    } else if (fn.startsWith('cytoscape.ElementStylesheetStyle')) {
        return 'stylesheet.' + fn.split('.').slice(2).join('.');
    } else if (fn.startsWith('cytoscape.ElementStylesheetCSS')) {
        return 'style.' + fn.split('.').slice(2).join('.');
    }
    return fn;
});

// Sort the formatted functions alphabetically
const sortedFunctions = formattedFunctions.sort();

// Output the functions as JSON
console.log(JSON.stringify(sortedFunctions, null, 2));