var cy = cytoscape({
  container: document.getElementById('cy'),
  style: cytoscape.stylesheet()
    .selector('node')
      .css({
        'content': 'data(name)',
        'text-valign': 'center',
        'color': 'white',
        'text-outline-width': 5,
        'text-outline-color': '#888',
        'width': 80,
        'height': 80
      })
    .selector('edge')
      .css({
        'content': 'data(name)',
        'width': 8,
        'line-color': '#888',
        'target-arrow-color': '#888',
        'source-arrow-color': '#888',
        'target-arrow-shape': 'triangle'
      })
    .selector(':selected')
//       .css({
//         'background-color': 'black',
//         'line-color': 'black',
//         'target-arrow-color': 'black',
//         'source-arrow-color': 'black',
//         'text-outline-color': 'black'
//       })
    .selector('$node > node')
      .css({
        'shape': 'roundrectangle',
        'text-valign': 'top',
        'height': 'auto',
        'width': 'auto',
        'background-color': '#ccc',
        'background-opacity': 0.333,
        'color': '#888',
        'text-outline-width':
        0,
        'font-size': 25
      })
//     .selector('#core')
//       .css({
//         'background-color': '#000',
//         'text-outline-color': '#000'
//       })
    .selector('#core, #app')
      .css({
        'width': 120,
        'height': 120,
        'font-size': 25
      })
    .selector('#api')
      .css({
        'padding-top': 20,
        'padding-left': 20,
        'padding-bottom': 20,
        'padding-right': 20
      })
    .selector('#ext, .ext')
      .css({
        'background-color': '#93CDDD',
        'text-outline-color': '#93CDDD',
        'line-color': '#93CDDD',
        'target-arrow-color': '#93CDDD'
      })
    .selector('#app, .app')
      .css({
        'background-color': '#F79646',
        'text-outline-color': '#F79646',
        'line-color': '#F79646',
        'target-arrow-color': '#F79646',
        'text-outline-color': '#F79646',
        'text-outline-width': 5,
        'color': '#fff'
      })
    .selector('#cy')
      .css({
        'background-opacity': 0,
        'border-width': 1,
        'border-color': '#aaa',
        'border-opacity': 0.5,
        'font-size': 50,
        'padding-top': 40,
        'padding-left': 40,
        'padding-bottom': 40,
        'padding-right': 40
      }),

  elements: {
    nodes: [
      {
        data: { id: 'cy', name: 'Cytoscape.js' }
      },

      {
        data: { id: 'core', name: 'Core', parent: 'api' },
        position: { x: 0, y: 0 }
      },

      {
        data: { id: 'eles', name: 'Collection', parent: 'api' },
        position: { x: 150, y: 150 }
      },

      {
        data: { id: 'style', name: 'Stylesheet', parent: 'api' },
        position: { x: 0, y: 150 }
      },

      {
        data: { id: 'selector', name: 'Selector', parent: 'api' },
        position: { x: -150, y: 150 }
      },

      {
        data: { id: 'ext', name: 'Extensions', parent: 'cy' }
      },

      {
        data: { id: 'corefn', name: 'Core Function', parent: 'ext' },
        classes: 'ext',
        position: { x: 350, y: -140 }
      },

      {
        data: { id: 'elesfn', name: 'Collection Function', parent: 'ext' },
        classes: 'ext',
        position: { x: 350, y: 0 }
      },

      {
        data: { id: 'layout', name: 'Layout', parent: 'ext' },
        classes: 'ext',
        position: { x: 350, y: 140 }
      },

      {
        data: { id: 'renderer', name: 'Renderer', parent: 'ext' },
        classes: 'ext',
        position: { x: 350, y: 280 }
      },

      {
        data: { id: 'api', name: 'Core API', parent: 'cy' }
      },

      {
        data: { id: 'app', name: 'Client' },
        position: { x: 0, y: 480 }
      }
    ],
    edges: [
      { data: { source: 'core', target: 'eles' } },
      { data: { source: 'core', target: 'ext' } },
      { data: { source: 'core', target: 'style' } },
      { data: { source: 'style', target: 'selector' } },
      { data: { source: 'core', target: 'selector' } },
      { data: { source: 'elesfn', target: 'eles' }, classes: 'ext' },
      { data: { source: 'corefn', target: 'core' }, classes: 'ext' },
      { data: { source: 'layout', target: 'api' }, classes: 'ext' },
      { data: { source: 'renderer', target: 'api' }, classes: 'ext' },
      { data: { source: 'app', target: 'api', name: 'use' }, classes: 'app' },
      { data: { source: 'app', target: 'ext', name: 'register' }, classes: 'app' }
    ]
  },

  layout: {
    name: 'preset'
  }
});
