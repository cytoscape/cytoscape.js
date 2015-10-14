/*!
 * This file is part of Cytoscape.js 2.4.9.
 *
 * Cytoscape.js is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option) any
 * later version.
 *
 * Cytoscape.js is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Lesser General Public License along with
 * Cytoscape.js. If not, see <http://www.gnu.org/licenses/>.
 */

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
    eval( m.$$eval );
  }
});
