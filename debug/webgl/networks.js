
var networks = {
  def: 'tiny',

  'tiny': {
    desc: 'tiny',
    nodes: 5,
    edges: 10,
    file: 'network-tiny.json',
    layout: { name: 'cose' }
  },
  'em-web': {
    desc: 'EM web',
    nodes: 569,
    edges: 6899,
    file: 'network-em-web.json',
    layout: { name: 'preset' }
  },
  'em-desktop': {
    desc: 'EM desktop',
    nodes: 1260,
    edges: 16030,
    file: 'network-em-desktop.json',
    layout: { name: 'preset' }
  },
  'ndex-large': {
    desc: 'NDEX large',
    nodes: 3238,
    edges: 68641,
    file: 'network-ndex-large.json',
    layout: { name: 'preset' }
  }
};

// some styles need to be in a .js file because some mappers use functions

var styles = {

  'em-desktop': {
    file: 'network-em-desktop-style.json'
  },

  'ndex-large': {
    file: 'network-ndex-large-style.json'
  },

  'em-web': [{
    selector: "node",
    style: {
      "border-width": "12px",
      "border-opacity": "0",
      "width": "40px",
      "height": "40px",
      "font-size": "8px",
      "text-valign": "center",
      "text-wrap": "wrap",
      "text-max-width": "80px",
      "z-index": "1",
      "label": "data(description)",
      "text-outline-width": 2,
      "color": "#fff",
      "background-color":   "mapData(NES, -3.14, 3.14, #0571b0, #ca0020)",
      "text-outline-color": "mapData(NES, -3.14, 3.14, #0571b0, #ca0020)"
    }
  },
  {
    selector: "edge",
    style: {
      "line-color" : "#888",
      "line-opacity": 0.3,
      "curve-style": "haystack",
      "haystack-radius": 0,
      "width": ele => ele.data('similarity_coefficient') * 15,
    }
  }],

  'tiny': [ 
    {
      selector: 'node',
      style: {
        'label': 'data(id)',
        'text-valign': 'center',
        'color': '#000000',
        'background-color': '#3a7ecf',
        'font-family': 'Helvetica'
      },
    }, {
      selector: '#n1',
      style: {
        'background-fill': 'linear-gradient',
        'background-gradient-stop-colors': 'cyan magenta yellow',
        'underlay-color': 'red',
        'underlay-shape': 'round-rectangle',
        'underlay-opacity': 0.5
      }
    }, {
      selector: '#n2',
      style: {
        'background-fill': 'linear-gradient',
        'background-gradient-direction': 'to-left',
        'background-gradient-stop-colors': 'gold red lawngreen'
      }
    }, {
      selector: '#n3',
      style: {
        'background-fill': 'radial-gradient',
        'background-gradient-stop-colors': 'cyan magenta yellow',
        'text-valign': 'top',
        'text-rotation': 3.14/2
      }
    }, {
      selector: '#n4',
      style: {
        "border-color": "black",
        "border-style": "dashed",
        "border-width": 2,
        'background-opacity': 0.5,
      }
    }, {
      selector: '#n5',
      style: {
        "border-color": "red",
        "border-style": "dotted",
        "border-width": 4,
        'width': 50,
        'background-opacity': 0.5,
        'text-valign': 'top'
      }
    }, {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#3a7ecf',
        'opacity': 0.5,
      },
    }, {
      selector: '#n1-n2',
      style: {
        'line-style': 'solid'
      }
    }, {
      selector: '#n1-n3',
      style: {
        'line-style': 'dotted'
      }
    }, {
      selector: '#n1-n4',
      style: {
        'line-style': 'dashed'
      }
    }, {
      selector: '#n1-n5',
      style: {
        'line-style': 'dashed',
        'line-dash-pattern': [1, 1, 4, 1],
      }
    }, {
      selector: '#n2-n3',
      style: {
        'line-fill': 'linear-gradient',
        'line-gradient-stop-colors': 'lawngreen red'
      }
    }, {
      selector: '#n2-n4',
      style: {
        'label': 'normal label',
        'font-size': '6px',
        'edge-text-rotation': 'autorotate',
      }
    }, {
      selector: '#n2-n5',
      style: {
        'label': 'bold label',
        'font-size': '6px',
        'edge-text-rotation': 'autorotate',
        'font-weight': 'bold'
      }
    }
  ],
};