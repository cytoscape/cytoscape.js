const fs = require('fs');
const path = require('path');

// Load and parse the JSON file
const jsonFilePath = path.resolve(__dirname, '..', 'documentation', 'docmaker.json');
const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

// Helper function to recursively extract functions
function extractFunctions(section) {
    let functions = [];

    if (section.fns) {
        section.fns.forEach(fn => {
            // Add the main function and formats
            if (fn.formats) {
                fn.formats.forEach(format => {
                    if (format.name) {
                        functions.push(format.name);
                    } else {
                        functions.push(fn.name);
                    }
                });
            } else {
                functions.push(fn.name);
            }

            // Add pureAliases the same number of times as the main function
            if (fn.pureAliases) {
                fn.pureAliases.forEach(alias => {
                    const count = functions.filter(f => f === fn.name).length;
                    for (let i = 0; i < count; i++) {
                        functions.push(alias);
                    }
                });
            }
        });
    }

    if (section.sections) {
        section.sections.forEach(subSection => {
            functions = functions.concat(extractFunctions(subSection));
        });
    }

    return functions;
}

// Extract functions from the JSON data
const functions = extractFunctions(jsonData);

// Sort the functions alphabetically
const sortedFunctions = functions.sort();

// Output the functions as JSON
console.log(JSON.stringify(sortedFunctions, null, 2));