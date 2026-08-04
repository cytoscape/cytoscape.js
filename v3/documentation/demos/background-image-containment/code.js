cytoscape({
  container: document.getElementById('cy'),
  boxSelectionEnabled: false,
  autounselectify: true,
  style: [{
    selector: 'node',
    style: {
      shape: 'round-rectangle',
      'background-image': ['https://live.staticflickr.com/7272/7633179468_3e19e45a0c_b.jpg', 'https://live.staticflickr.com/3063/2751740612_af11fb090b_b.jpg'],
      'background-image-containment': ['over', 'inside'],
      'background-clip': ['none', 'none'],
      'bounds-expansion': 25,
      'background-width': [20, 20],
      'background-height': [20, 20],
      'background-position-x': ['-10','120%'],
      'background-position-y': ['-10','-10'],
      'background-color': 'lightgray',
      'border-color': 'gray',
      'border-width': 1,
     
      'text-halign': 'center',
      'text-valign': 'center',
      width: 65,
      height: 30
    }
  }],
  elements: {
    nodes: [
      { data: { id: 'inside', name: 'Test', } },
    ]
  },
  layout: {
    name: 'grid',
    padding: 10
  }
});
