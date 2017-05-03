fetch('data.json', {mode: 'no-cors'})
  .then(function(res) {
    return res.json()
  })
  .then(function(data) {
    var cy = cytoscape({
      container: document.getElementById('cy'),

      style: cytoscape.stylesheet()
        .selector('node')
          .css({
            'font-size': 10,
            'content': 'data(gene_name)',
            'text-valign': 'center',
            'color': 'white',
            'text-outline-width': 2,
            'text-outline-color': '#888',
            'min-zoomed-font-size': 8,
            'width': 'mapData(score, 0, 1, 20, 50)',
            'height': 'mapData(score, 0, 1, 20, 50)'
          })
        .selector('node[node_type = "query"]')
          .css({
            'background-color': '#666',
            'text-outline-color': '#666'
          })
        .selector('node:selected')
          .css({
            'background-color': '#000',
            'text-outline-color': '#000'
          })
        .selector('edge')
          .css({
            'curve-style': 'haystack',
            'opacity': 0.333,
            'width': 'mapData(normalized_max_weight, 0, 0.01, 1, 2)'
          })
        .selector('edge[data_type = "Predicted"]')
          .css({
            'line-color': '#F6C28C'
          })
        .selector('edge[data_type = "Physical interactions"]')
          .css({
            'line-color': '#EAA2A3'
          })
        .selector('edge[data_type = "Shared protein domains"]')
          .css({
            'line-color': '#DAD4A8'
          })
        .selector('edge[data_type = "Co-expression"]')
          .css({
            'line-color': '#D0B7D3'
          })
        .selector('edge[data_type = "Pathway"]')
          .css({
            'line-color': '#9BD8DD'
          })
        .selector('edge[data_type = "Co-localization"]')
          .css({
            'line-color': '#A0B3D8'
          })
      .selector('edge:selected')
        .css({
          opacity: 1
        }),

      elements: data.elements,

      layout: {
        name: 'concentric',
        concentric: function(ele){
          return ele.data('score');
        },
        levelWidth: function(nodes){
          return 0.5;
        },
        padding: 10
      }
    });
  });
