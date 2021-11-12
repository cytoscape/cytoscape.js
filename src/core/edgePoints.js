let corefn = ({

  segmentsToRelativePositions: function( segmentPoints, sourcePoint, targetPoint ){
    let result = convertToRelativePositions( segmentPoints, sourcePoint, targetPoint );

    return { distances: result.distances, weights: result.weights };
  },

  controlsToRelativePositions: function( controlPoints, sourcePoint, targetPoint ){
    let result = convertToRelativePositions( controlPoints, sourcePoint, targetPoint );
    
    return { distances: result.distances, weights: result.weights };
  }

});

/** functions required to convert bend(anchor) points to segment/control points **/

function getSrcTgtPointsAndTangents(srcPoint, tgtPoint) {
  let m1 = (tgtPoint.y - srcPoint.y) / (tgtPoint.x - srcPoint.x);
  let m2 = -1 / m1;

  return {
    m1: m1,
    m2: m2,
    srcPoint: srcPoint,
    tgtPoint: tgtPoint
  };
};

function getIntersection( anchor, srcTgtPointsAndTangents ){
  let srcPoint = srcTgtPointsAndTangents.srcPoint;
  let tgtPoint = srcTgtPointsAndTangents.tgtPoint;
  let m1 = srcTgtPointsAndTangents.m1;
  let m2 = srcTgtPointsAndTangents.m2;

  let intersectX;
  let intersectY;

  if(m1 == Infinity || m1 == -Infinity){
    intersectX = srcPoint.x;
    intersectY = anchor.y;
  }
  else if(m1 == 0){
    intersectX = anchor.x;
    intersectY = srcPoint.y;
  }
  else {
    let a1 = srcPoint.y - m1 * srcPoint.x;
    let a2 = anchor.y - m2 * anchor.x;

    intersectX = (a2 - a1) / (m1 - m2);
    intersectY = m1 * intersectX + a1;
  }

  // intersection point is the intersection of the lines passing through the nodes and
  // passing through the bend or control point and perpendicular to the other line
  let intersectionPoint = {
    x: intersectX,
    y: intersectY
  };
  
  return intersectionPoint;
};

function getLineDirection( srcPoint, tgtPoint ){
  if(srcPoint.y == tgtPoint.y && srcPoint.x < tgtPoint.x){
    return 1;
  }
  if(srcPoint.y < tgtPoint.y && srcPoint.x < tgtPoint.x){
    return 2;
  }
  if(srcPoint.y < tgtPoint.y && srcPoint.x == tgtPoint.x){
    return 3;
  }
  if(srcPoint.y < tgtPoint.y && srcPoint.x > tgtPoint.x){
    return 4;
  }
  if(srcPoint.y == tgtPoint.y && srcPoint.x > tgtPoint.x){
    return 5;
  }
  if(srcPoint.y > tgtPoint.y && srcPoint.x > tgtPoint.x){
    return 6;
  }
  if(srcPoint.y > tgtPoint.y && srcPoint.x == tgtPoint.x){
    return 7;
  }
  return 8; // if srcPoint.y > tgtPoint.y and srcPoint.x < tgtPoint.x
};

function convertToRelativePosition( anchor, srcTgtPointsAndTangents ){
  let intersectionPoint = getIntersection(anchor, srcTgtPointsAndTangents);
  let intersectX = intersectionPoint.x;
  let intersectY = intersectionPoint.y;
  
  let srcPoint = srcTgtPointsAndTangents.srcPoint;
  let tgtPoint = srcTgtPointsAndTangents.tgtPoint;
  
  let weight;
  
  if( intersectX != srcPoint.x ) {
    weight = (intersectX - srcPoint.x) / (tgtPoint.x - srcPoint.x);
  }
  else if( intersectY != srcPoint.y ) {
    weight = (intersectY - srcPoint.y) / (tgtPoint.y - srcPoint.y);
  }
  else {
    weight = 0;
  }
  
  let distance = Math.sqrt(Math.pow((intersectY - anchor.y), 2)
      + Math.pow((intersectX - anchor.x), 2));
  
  // get the direction of the line form source point to target point
  let direction1 = getLineDirection(srcPoint, tgtPoint);
  // get the direction of the line from intesection point to the point
  let direction2 = getLineDirection(intersectionPoint, anchor);
  
  // if the difference is not -2 and not 6 then the direction of the distance is negative
  if(direction1 - direction2 != -2 && direction1 - direction2 != 6){
    if(distance != 0)
      distance = -1 * distance;
  }
  
  return {
    weight: weight,
    distance: distance
  };
};

function convertToRelativePositions( anchorPoints, srcPoint, tgtPoint ){
  let srcTgtPointsAndTangents = getSrcTgtPointsAndTangents(srcPoint, tgtPoint);

  let weights = [];
  let distances = [];

  for (let i = 0; anchorPoints && i < anchorPoints.length; i++) {
    let anchor = anchorPoints[i];
    let relativeAnchorPosition = convertToRelativePosition(anchor, srcTgtPointsAndTangents);

    weights.push(relativeAnchorPosition.weight);
    distances.push(relativeAnchorPosition.distance);
  }

  return {
    weights: weights,
    distances: distances
  };
};

export default corefn;