$(function(){
  
  // fix for webkit
  $('#navigation').on('mousewheel DOMMouseScroll MozMousePixelScroll', function(e){
    e.stopPropagation();
  });


  // avoid weird rendering bug in chrome etc
  $('#navigation a').on('click', function(){
    var scroll = $('#navigation').scrollTop();

    $('#navigation').scrollTop( scroll + 1 );
    $('#navigation').scrollTop( scroll );
  });

  function refresh(){
    $('#cy').cytoscape({
      showOverlay: false,

      style: cytoscape.stylesheet()
        .selector('node')
          .css({
            'content': 'data(name)',
            'text-outline-width': 2,
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
            'width': 'mapData(weight, 0, 100, 2, 5)'
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
        window.cy = this;
      }
    });
  }

  refresh();

  $('#cy-refresh').on('mousedown touchstart', function(){
    refresh();
  });

  var $codes = $('pre code[class = "lang-js"]');
  for( var i = 0; i < $codes.length; i++ ){
    var $code = $( $codes[i] );
    var $parent = $code.parent();
    var $button = $('<button class="run"><span class="icon-play"></span> Run code</button>');
    var text = $code.text();

    $parent.before( $button );

    (function(text){
      $button.on('click', function(){
        $('#cy-title .content').html( text ).hide().fadeIn(100).delay(1000).hide(200, function(){
          var ret = eval( text );
          console.log(ret)
        });

      });
    })(text)
  }

});