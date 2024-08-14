const fs = require('fs');
const path = require('path');

// Load the Markdown file
const markdownFilePath = path.resolve(__dirname, '..', 'documentation', 'md', 'style.md');
const markdownContent = fs.readFileSync(markdownFilePath, 'utf8');

// Define a regex to match the style properties
const stylePropertyRegex = /\*\*`([^`]+)`\*\*/g;

// Extract style properties
let match;
const styleProperties = [];

while ((match = stylePropertyRegex.exec(markdownContent)) !== null) {
    const property = match[1];
    // Omit entries that have parentheses
    if (!property.includes('(')) {
        // Handle entries like <pos>
        if (property.includes('<pos>')) {
            ['source', 'mid-source', 'target', 'mid-target'].forEach(pos => {
                styleProperties.push(property.replace('<pos>', pos));
            });
        } else if (property.includes('pie-i')) {
            // Handle pie-i properties
            styleProperties.push(property);
            for (let i = 1; i <= 16; i++) {
                styleProperties.push(property.replace('pie-i', `pie-${i}`));
            }
        } else {
            styleProperties.push(property);
        }
    }
}

// Remove duplicates and sort the style properties alphabetically
const uniqueSortedStyleProperties = Array.from(new Set(styleProperties)).sort();

// Output the style properties as JSON
console.log(JSON.stringify(uniqueSortedStyleProperties, null, 2));