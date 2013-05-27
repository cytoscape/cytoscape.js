$(function(){

  setTimeout(function(){
    cytoscape.defaults( window.options );
  }, 100);

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

  loadCy();

  $('#cy-refresh').on('mousedown touchstart', function(){
    loadCy();

    $('#cy').attr('style', '');
  });

  $('#cy-hide').on('mousedown touchstart', function(){
    $('#cy, #cy-hide, #cy-refresh').hide();
    $('#cy-show').show();
  });

  $('#cy-show').on('mousedown touchstart', function(){
    $('#cy, #cy-hide, #cy-refresh').show();
    $('#cy-show').hide();
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
        $('#cy-title .content').html( text ).hide().fadeIn(100).delay(250).hide(200, function(){
          var ret = eval( text );
          
          if( ret && cytoscape.is.elementOrCollection( ret ) && ret.length > 0 ){
            //console.log(ret)

            var css = {
              'text-outline-color': '#4183C4',
              'background-color': '#4183C4',
              'line-color': '#4183C4',
              'target-arrow-color': '#4183C4',
              'source-arrow-color': '#4183C4'
            };

            var delay = 200;

            ret
              .stop( true )

              .animate({ css: css })
              
              .delay(delay, function(){
                ret.removeCss();
              })

              .animate({ css: css })
              
              .delay(delay, function(){
                ret.removeCss();
              })

              .animate({ css: css })
              
              .delay(delay, function(){
                ret.removeCss();
              })
            ;

          }
        });

      });
    })(text)
  }

});