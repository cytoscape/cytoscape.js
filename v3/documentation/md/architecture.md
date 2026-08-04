Cytoscape.js uses an event-driven model with a core API.  The core has several extensions, each of which is notified of events by the core, as needed.  Extensions modify the elements in the graph and notify the core of any changes.

The client application accesses Cytoscape.js solely through the [core](#core).  Clients do not access extensions directly, apart from the case where a client wishes to write their own custom extension.

The following diagramme summarises the extensions of Cytoscape.js, which are discussed in further detail [elsewhere in this documentation](#extensions).