## Details

The midpoint is, by default, where the edge's label is centred. It is also the position towards which mid arrows point.

For `curve-style: unbundled-bezier` edges, the midpoint is the middle extremum if the number of control points is odd.  

For an even number of control points, the midpoint is where the two middle-most control points meet.  This is the middle inflection point for bilaterally symmetric or skew symmetric edges, for example.

For `curve-style: segments` edges, the midpoint is the middle segment point if the number of segment points is odd.  For an even number of segment points, the overall midpoint is the midpoint of the middle-most line segment (i.e. the mean of the middle two segment points).
