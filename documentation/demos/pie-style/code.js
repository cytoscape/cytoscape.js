cytoscape({
  container: document.getElementById('cy'),

  style: cytoscape.stylesheet()
    .selector('node')
      .css({
        'width': '60px',
        'height': '60px',
        'content': 'data(id)',
        'pie-size': '80%',
        'pie-1-background-color': '#E8747C',
        'pie-1-background-size': 'mapData(foo, 0, 10, 0, 100)',
        'pie-2-background-color': '#74CBE8',
        'pie-2-background-size': 'mapData(bar, 0, 10, 0, 100)',
        'pie-3-background-color': '#74E883',
        'pie-3-background-size': 'mapData(baz, 0, 10, 0, 100)'
      })
    .selector('edge')
      .css({
        'curve-style': 'bezier',
        'width': 4,
        'target-arrow-shape': 'triangle',
        'opacity': 0.5
      })
    .selector(':selected')
      .css({
        'background-color': 'black',
        'line-color': 'black',
        'target-arrow-color': 'black',
        'source-arrow-color': 'black',
        'opacity': 1
      })
    .selector('.faded')
      .css({
        'opacity': 0.25,
        'text-opacity': 0
      }),

  elements: {
    nodes: [
      { data: { id: 'a', foo: 3, bar: 5, baz: 2 } },
      { data: { id: 'b', foo: 6, bar: 1, baz: 3 } },
      { data: { id: 'c', foo: 2, bar: 3, baz: 5 } },
      { data: { id: 'd', foo: 7, bar: 1, baz: 2 } },
      { data: { id: 'e', foo: 2, bar: 3, baz: 5 } }
    ],

    edges: [
      { data: { id: 'ae', weight: 1, source: 'a', target: 'e' } },
      { data: { id: 'ab', weight: 3, source: 'a', target: 'b' } },
      { data: { id: 'be', weight: 4, source: 'b', target: 'e' } },
      { data: { id: 'bc', weight: 5, source: 'b', target: 'c' } },
      { data: { id: 'ce', weight: 6, source: 'c', target: 'e' } },
      { data: { id: 'cd', weight: 2, source: 'c', target: 'd' } },
      { data: { id: 'de', weight: 7, source: 'd', target: 'e' } }
    ]
  },

  layout: {
    name: 'circle',
    padding: 10
  },

  ready: function(){
    window.cy = this;
  }
});
