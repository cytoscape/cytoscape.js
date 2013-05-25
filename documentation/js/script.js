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

  loadCy();

  $('#cy-refresh').on('mousedown touchstart', function(){
    loadCy();
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
        $('#cy-title .content').html( text ).hide().fadeIn(100).delay(1000).hide(200, function(){
          var ret = eval( text );
          console.log(ret)
        });

      });
    })(text)
  }

});