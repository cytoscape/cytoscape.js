all: scripts docmaker 

scripts:
	cp ../build/cytoscape.min.js js/cytoscape.min.js
	cp ../build/cytoscape.js js/cytoscape.js
	cp ../lib/arbor.js js/arbor.js

docmaker:
	npm install
	node docmaker

clean:
	rm -rf index.html node_modules js/cytoscape.js js/cytoscape.min.js
