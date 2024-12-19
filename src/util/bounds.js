import { hashIntsArray } from '.';

export const getBoundingBoxPosKey = (ele) => {
  if (ele.isEdge()) {
    let p1 = ele.source().position();
    let p2 = ele.target().position();
    let r = (x) => Math.round(x);

    return hashIntsArray([r(p1.x), r(p1.y), r(p2.x), r(p2.y)]);
  } else {
    return 0;
  }
};
