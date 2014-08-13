$(function(){

  setTimeout(function(){
    cytoscape.defaults( window.options );
  }, 100);

  // fix for webkit
  $('#navigation').on('wheel mousewheel DOMMouseScroll MozMousePixelScroll', function(e){
    e.stopPropagation();
  });


  // avoid weird rendering bug in chrome etc
  $('#navigation a').on('click', function(){
    var scroll = $('#navigation').scrollTop();

    // force navigation to rerender, because some browsers (looking at you, chrome)
    // don't render properly after clicking one of the links
    setTimeout(function(){
      $('#navigation').scrollTop( scroll + 10 );
      $('#navigation').scrollTop( scroll - 10 );
      $('#navigation').scrollTop( scroll );
    }, 0);
  });

  loadCy();

  $(document).on('click', '.gallery-refresh', function(){
    var embedId = $(this).attr('data-embed-id');
    var embed = document.getElementById(embedId);

    embed.classList.remove('loaded');

    embed.src = embed.src;
  });

  $('.gallery-embed').on('load', function(){
    $(this).addClass('loaded');
  });

  $('#cy-refresh').on('click', function(){
    loadCy();

    $('#cy').attr('style', '');
  });

  window.showCy = function(){
    $('#cy, #cy-hide, #cy-refresh').removeClass('hidden');
    $('#cy-show').addClass('hidden');

    cy.resize();
  };

  window.hideCy = function(){
    $('#cy, #cy-hide, #cy-refresh').addClass('hidden');
    $('#cy-show').removeClass('hidden');
  };

  $('#cy-hide').on('click', function(){
    hideCy();
  });

  $('#cy-show').on('click', function(){
    showCy();
  });


  $('#demo-source .expander').on('click', function(){
    $('#demo-source').removeClass('collapsed');
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
        showCy();
        
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

  $('#download-button').on('click', function(){
    if( _gaq ){
      _gaq.push(['_trackEvent', 'Actions', 'Download']);
    }
  });

});