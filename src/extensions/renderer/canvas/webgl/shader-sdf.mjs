// Fragment shader functions to calculate signed distance fields (SDFs)
// https://iquilezles.org/articles/distfunctions2d/

/**
 * param p - point
 * float r - circle radius, eg 0.5 for unit circle
 */
export const circleSDF = `
  float circleSDF(vec2 p, float r) {
    return distance(vec2(0), p) - r; // signed distance
  }
`;

/**
 * param p - point
 * param b - b.x = half width, b.y = half height
 * param cr - vector of corner radiuses
 */
export const roundRectangleSDF = `
  float roundRectangleSDF(vec2 p, vec2 b, vec4 cr) {
    cr.xy = (p.x > 0.0) ? cr.xy : cr.zw;
    cr.x  = (p.y > 0.0) ? cr.x  : cr.y;
    vec2 q = abs(p) - b + cr.x;
    return min(max(q.x, q.y), 0.0) + distance(vec2(0), max(q, 0.0)) - cr.x;
  }
`;

/**
 * param p - point
 * param ab - a.x = horizontal radius, a.y = vertical radius
 */
export const ellipseSDF = `
  float ellipseSDF(vec2 p, vec2 ab) {
    p = abs(p); 
    if(p.x > p.y ) {p=p.yx;ab=ab.yx;}
    float l = ab.y*ab.y - ab.x*ab.x;
    float m = ab.x*p.x/l;      float m2 = m*m; 
    float n = ab.y*p.y/l;      float n2 = n*n; 
    float c = (m2+n2-1.0)/3.0; float c3 = c*c*c;
    float q = c3 + m2*n2*2.0;
    float d = c3 + m2*n2;
    float g = m + m*n2;
    float co;
    if( d<0.0 ) {
      float h = acos(q/c3)/3.0;
      float s = cos(h);
      float t = sin(h)*sqrt(3.0);
      float rx = sqrt( -c*(s + t + 2.0) + m2 );
      float ry = sqrt( -c*(s - t + 2.0) + m2 );
      co = (ry+sign(l)*rx+abs(g)/(rx*ry)- m)/2.0;
    }
    else {
      float h = 2.0*m*n*sqrt( d );
      float s = sign(q+h)*pow(abs(q+h), 1.0/3.0);
      float u = sign(q-h)*pow(abs(q-h), 1.0/3.0);
      float rx = -s - u - c*4.0 + 2.0*m2;
      float ry = (s - u)*sqrt(3.0);
      float rm = sqrt( rx*rx + ry*ry );
      co = (ry/sqrt(rm-rx)+2.0*g/rm-m)/2.0;
    }
    vec2 r = ab * vec2(co, sqrt(1.0-co*co));
    return length(r-p) * sign(p.y-r.y);
  }
`;