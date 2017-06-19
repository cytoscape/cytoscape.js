$(function() {

  // setTimeout(function(){
  //   cytoscape.defaults( window.options );
  // }, 100);

  // fix for webkit
  $('#navigation').on('wheel mousewheel DOMMouseScroll MozMousePixelScroll scroll', function(e) {
    e.stopPropagation();
  });

  $('#open-navigation').on('click', function() {
    $('body').addClass('navigation-open');
  });

  $('#open-navigation-bg, #navigation a').on('click', function() {
    $('body').removeClass('navigation-open');
  });


  // avoid weird rendering bug in chrome etc
  $('#navigation a').on('click', function() {
    var scroll = $('#navigation').scrollTop();

    // force navigation to rerender, because some browsers (looking at you, chrome)
    // don't render properly after clicking one of the links
    setTimeout(function() {
      $('#navigation').scrollTop(scroll + 10);
      $('#navigation').scrollTop(scroll - 10);
      $('#navigation').scrollTop(scroll);
    }, 0);
  });

  function debounce(fn, delay) {
    var timeout;

    return function() {
      var context = this;
      var args = arguments;

      clearTimeout(timeout);
      timeout = setTimeout(function() {
        timeout = null;

        fn.apply(context, args);
      }, delay);
    };
  };

  var $toclinks = $('.section > .toclink');
  var $tocinput = $('#toc-input');
  var $tocsections = $('#toc-sections');
  var lastTxt;

  var filterSections = debounce(function() {
    txt = $tocinput.val().toLowerCase();

    var $shown = txt === '' ? $toclinks : $toclinks.filter(function(i, ele) {
      return ele.text.toLowerCase().match(txt);
    });

    var $notShown = $toclinks.not($shown);

    $shown.show();
    $notShown.hide();

    $shown.parent().each(function(i, ele) {
      var $section = $(ele);

      if ($section.hasClass('lvl3')) {
        $section.prevAll('.lvl2:first').children('.toclink').show();
        $section.prevAll('.lvl1:first').children('.toclink').show();
      } else if ($section.hasClass('lvl2')) {
        $section.prevAll('.lvl1:first').children('.toclink').show();
        $section.nextUntil('.lvl2, .lvl1').children('.toclink').show();
      } else if ($section.hasClass('lvl1')) {
        $section.nextUntil('.lvl1').children('.toclink').show();
      }
    });

    $tocsections.removeClass('toc-sections-searching');
  }, 250);

  $tocinput.on('keydown keyup keypress change', function() {
    txt = $tocinput.val().toLowerCase();

    if (txt === lastTxt) {
      return;
    }
    lastTxt = txt;

    $tocsections.addClass('toc-sections-searching');

    filterSections();
  });

  $('#toc-clear').on('click', function() {
    $tocinput.val('').trigger('change');
  });

  loadCy();

  $(document).on('click', '.gallery-refresh', function() {
    var embedId = $(this).attr('data-embed-id');
    var embed = document.getElementById(embedId);

    embed.classList.remove('loaded');

    embed.src = embed.src;
  });

  $('.gallery-embed').on('load', function() {
    $(this).addClass('loaded');
  });

  $('body').on('mousedown click', '#cy-refresh', function() {
    loadCy();

    $('#cy').attr('style', ''); // because some example fiddles w/ this
  });

  window.showCy = function($ele) {
    $('#cy, #cy-hide, #cy-refresh, #cy-label').removeClass('hidden');
    $('#cy-show').addClass('hidden');

    if ($ele) {
      var $etc = $('#cy-etc');

      $etc.removeClass('hidden').remove();
      $ele.after($etc);
    }

    cy.resize();
  };

  window.hideCy = function() {
    $('#cy, #cy-hide, #cy-refresh, #cy-label, #cy-etc').addClass('hidden');
    $('#cy-show').removeClass('hidden');
  };

  $('#cy-hide').on('click', function() {
    hideCy();
  });

  $('#cy-show').on('click', function() {
    showCy();
  });


  $('#demo-source .expander').on('click', function() {
    $('#demo-source').removeClass('collapsed');
  });

  $(document).on('click', '.run.run-inline-code', function() {
    var $run = $(this);
    var $pre = $(this).prevAll('pre:first');

    showCy($run);

    var text = $pre.text();

    var $title = $('#cy-title');
    var $content = $title.find('.content');

    $content.html(text);
    $title.show();

    $content.hide().fadeIn(100).delay(250).hide(200, function() {
      var ret = eval(text);

      var isEles = function(o) {
        return o != null && o.isNode != null;
      }

      if (isEles(ret) && ret.length > 0) {

        var css = {
          'text-outline-color': '#4183C4',
          'background-color': '#4183C4',
          'line-color': '#4183C4',
          'target-arrow-color': '#4183C4',
          'source-arrow-color': '#4183C4'
        };

        var delay = 200;

        ret
          .stop(true)

          .animate({
            css: css
          })

          .delay(delay, function() {
            ret.removeCss();
          })

          .animate({
            css: css
          })

          .delay(delay, function() {
            ret.removeCss();
          })

          .animate({
            css: css
          })

          .delay(delay, function() {
            ret.removeCss();
            $title.hide();
          });

      }
    });

  });

  $('#download-button').on('click', function() {
    if (_gaq) {
      _gaq.push(['_trackEvent', 'Actions', 'Download']);
    }
  });

});
