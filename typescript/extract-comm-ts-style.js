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

// Helper function to recursively find the Css namespace
function findCssNamespace(node) {
    let cssNode = null;

    function recurse(currentNode) {
        if (ts.isModuleDeclaration(currentNode) && currentNode.name.text === 'Css') {
            cssNode = currentNode;
        } else {
            ts.forEachChild(currentNode, child => recurse(child));
        }
    }

    recurse(node);
    return cssNode;
}

// Helper function to recursively extract style properties from nested structures within Css namespace
function extractCssProperties(node) {
    let styles = [];

    if (ts.isInterfaceDeclaration(node)) {
        node.members.forEach(member => {
            if (ts.isPropertySignature(member)) {
                const name = member.name.text;
                styles.push(name);
            }
        });
    } else {
        ts.forEachChild(node, child => {
            styles = styles.concat(extractCssProperties(child));
        });
    }

    return styles;
}

// Find the Css namespace
const cssNamespace = findCssNamespace(sourceFile);

if (cssNamespace) {
    // Extract styles from the Css namespace
    const styles = extractCssProperties(cssNamespace);

    // Remove duplicates and sort the styles alphabetically
    const uniqueSortedStyles = Array.from(new Set(styles)).sort();

    // Output the styles as JSON
    console.log(JSON.stringify(uniqueSortedStyles, null, 2));
} else {
    console.error('Css namespace not found in the provided TypeScript definition file.');
}