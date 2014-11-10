// normalised worker api functions for nodejs

// expose message() for client code to use
function message( m ){
  process.send( m );
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

process.on('message', function( m ){
  if( typeof m === 'object' && m.$$eval ){
    eval( m.$$eval );
  }
}); 