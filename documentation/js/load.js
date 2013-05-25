$(loadCy = function(){

  options = {
    showOverlay: false,

    style: cytoscape.stylesheet()
      .selector('node')
        .css({
          'content': 'data(name)',
          'text-outline-width': 3,
          'text-outline-color': '#fff',
          'width': 'mapData(weight, 0, 100, 20, 50)',
          'height': 'mapData(weight, 0, 100, 20, 50)'
        })
      .selector(':selected')
        .css({
          'background-color': '#000',
          'line-color': '#000',
          'target-arrow-color': '#000'
        })
      .selector('edge')
        .css({
          'width': 3
        })
    ,

    elements: [
      {
        data: { id: 'j', name: 'Jerry', weight: 65, height: 174 }, 
        group: 'nodes'
      },

      {
        data: { id: 'e', name: 'Elaine', weight: 48, height: 160 },
        group: 'nodes'
      },

      {
        data: { id: 'k', name: 'Kramer', weight: 24 },
        group: 'nodes'
      },

      {
        data: { id: 'g', weight: 64 },
        group: 'nodes'
      }
    ],

    ready: function(){
      cy = this;
    }
  };

  $('#cy').cytoscape(options);

});