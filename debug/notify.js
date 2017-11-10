/* global $ */
/* eslint-disable no-console */

var notify = function( name, descr ){
  console.log( name );
  console.log( descr );

  $('#note-name').innerHTML = ( name );
  $('#note-descr').innerHTML = ( descr );

  $('#note').style.display = 'block';

  clearTimeout( notify.timeout );

  notify.timeout = setTimeout( function(){
    $('#note').style.display = 'none';
  }, 3000 );
};
