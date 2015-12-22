/* jshint ignore:start */

// normalised thread api functions for nodejs

// expose message() for client code to use
function message( m ){
  process.send( m );
}

function broadcast( m ){
  return message( m );
}

// expose listen() for client message binding
function listen( fn ){
  process.on('message', function( m ){
    if( typeof m === 'object' && m.$$eval ){
      return;
    } else {
      fn( m );
    }
  });
}

function resolve( v ){
  process.send({
    $$resolve: v
  });
}

function reject( v ){
  process.send({
    $$reject: v
  });
}

process.on('message', function( m ){
  if( typeof m === 'object' && m.$$eval ){
    function _ref_( o ){
      return eval( o );
    }

    eval( m.$$eval );
  }
});

/* jshint ignore:end */
