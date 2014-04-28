## Details

Two edges are said to be parallel if they connect the same two nodes.  That is,

 * `edge1.source().id() === edge2.source().id() && edge1.target().id() === edge2.target().id()` or 
 * `edge1.source().id() === edge2.target().id() && edge1.target().id() === edge2.source().id()`.