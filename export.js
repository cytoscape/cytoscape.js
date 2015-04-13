// cytoscape.js makes `cytoscape` global on the window (or global) object, while Meteor expects a file-scoped global variable
cytoscape = this.cytoscape;
delete this.cytoscape;