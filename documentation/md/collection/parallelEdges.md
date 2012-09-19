## Details

Two edges are said to be parallel if they connect the same two nodes.  That is,

 * `edge1.source() === edge2.source() && edge1.target() === edge2.target()` or 
 * `edge1.source() === edge2.target() && edge1.target() === edge2.source()`.