$( loadCy = function(){

//<demo>

// initialise cytoscape.js on a html dom element with some options:
cytoscape( options = {
  container: document.getElementById('cy'),

  minZoom: 0.5,
  maxZoom: 2,

  // style can be specified as plain JSON, a stylesheet string (probably a CSS-like
  // file pulled from the server), or in a functional format
  style: [
    {
      selector: 'node',
      css: {
        'content': 'data(name)',
        'font-family': 'helvetica',
        'font-size': 14,
        'text-outline-width': 3,
        'text-outline-color': '#888',
        'text-valign': 'center',
        'color': '#fff',
        'width': 'mapData(weight, 30, 80, 20, 50)',
        'height': 'mapData(height, 0, 200, 10, 45)',
        'border-color': '#fff'
      }
    },

    {
      selector: ':selected',
      css: {
        'background-color': '#000',
        'line-color': '#000',
        'target-arrow-color': '#000',
        'text-outline-color': '#000'
      }
    },

    {
      selector: 'edge',
      css: {
        'width': 2,
        'target-arrow-shape': 'triangle'
      }
    }
  ],

  // specify the elements in the graph
  elements: {
    nodes: [
      { data: { id: 'j', name: 'Jerry', weight: 65, height: 174 } },
      { data: { id: 'e', name: 'Elaine', weight: 48, height: 160 } },
      { data: { id: 'k', name: 'Kramer', weight: 75, height: 185 } },
      { data: { id: 'g', name: 'George', weight: 70, height: 150 } }
    ],

    edges: [
      { data: { source: 'j', target: 'e' } },
      { data: { source: 'j', target: 'k' } },
      { data: { source: 'j', target: 'g' } },

      { data: { source: 'e', target: 'j' } },
      { data: { source: 'e', target: 'k' } },

      { data: { source: 'k', target: 'j' } },
      { data: { source: 'k', target: 'e' } },
      { data: { source: 'k', target: 'g' } },

      { data: { source: 'g', target: 'j' } }
    ],
  },

  // wait for the data to load & the layout to run before using the api...
  ready: function(){
    cy = this;
  }
} );

//</demo>

} );