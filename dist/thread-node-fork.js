
/*!

Cytoscape.js snapshot-564e9ad5ee-1466537151217 (MIT licensed)

Copyright (c) The Cytoscape Consortium

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the “Software”), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

'use strict';

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
