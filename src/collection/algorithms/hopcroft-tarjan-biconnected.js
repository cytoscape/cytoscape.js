let hopcroftTarjanBiconnected = function() {

  let eles = this;
  let nodes = {};
  let id = 0;
  let edgeCount = 0;
  let components = [];
  let stack = [];
  let visitedEdges = {};
  let loops = {};

  const buildComponent = (x, y) => {
    let i = stack.length-1;
    let cutset = [];
    let visitedNodes = {};
    let component = [];

    while (stack[i].x != x || stack[i].y != y) {
      cutset.push(stack.pop().edge);
      i--;
    }
    cutset.push(stack.pop().edge);

    cutset.forEach(edge => {
      component.push(edge);
      let connectedNodes = edge.connectedNodes().intersection(eles);

      connectedNodes.forEach(node => {
        let nodeId = node.id();

        if (!(nodeId in visitedNodes)) {
          visitedNodes[nodeId] = true;

          if (nodeId in loops) {
            loops[nodeId].forEach(loop => component.push(loop));
          }
          component.push(node);
        }
      });
    });

    components.push(eles.spawn(component));
  };

  const biconnectedSearch = (root, currentNode, parent) => {
    if (root == parent) edgeCount += 1;
    nodes[currentNode] = {
      id : id,
      low : id++,
      cutVertex : false
    };
    let edges = eles.getElementById(currentNode).connectedEdges().intersection(eles);

    if (edges.size() === 0) {
      components.push(eles.spawn(eles.getElementById(currentNode)));
    } else {
      let sourceId, targetId, otherNodeId, edgeId, isEdgeLoop;

      edges.forEach(edge => {
        sourceId = edge.source().id();
        targetId = edge.target().id();
        otherNodeId = (sourceId == currentNode) ? targetId : sourceId;
        isEdgeLoop = edge.isLoop();

        if (isEdgeLoop) {
          if (sourceId in loops) {
            loops.push(edge);
          } else {
            loops[sourceId] = [edge];
          }
        } else if (otherNodeId != parent) {
          edgeId = edge.id();

          if (!visitedEdges[edgeId]) {
            visitedEdges[edgeId] = true;
            stack.push({
              x : currentNode,
              y : otherNodeId,
              edge : eles.getElementById(edgeId)
            });
          }

          if (!(otherNodeId in nodes)) {
            biconnectedSearch(root, otherNodeId, currentNode);
            nodes[currentNode].low = Math.min(nodes[currentNode].low, nodes[otherNodeId].low);

            if (nodes[currentNode].id <= nodes[otherNodeId].low) {
              nodes[currentNode].cutVertex = true;
              buildComponent(currentNode, otherNodeId);
            }
          } else {
            nodes[currentNode].low = Math.min(nodes[currentNode].low, nodes[otherNodeId].id);
          }
        }
      });
    }
  };

  eles.forEach(ele => {

    if (ele.isNode()) {
      let nodeId = ele.id();

      if (!(nodeId in nodes)) {
        edgeCount = 0;
        biconnectedSearch(nodeId, nodeId, "");
        nodes[nodeId].cutVertex = (edgeCount > 1);
      }
    }
  });

  let cutVertices = Object.keys(nodes)
    .filter(id => nodes[id].cutVertex)
    .map(id => eles.getElementById(id));

  return {
    cut: eles.spawn(cutVertices),
    components: components
  };

};

export default { 
  hopcroftTarjanBiconnected, 
  htbc: hopcroftTarjanBiconnected, 
  htb: hopcroftTarjanBiconnected,
  hopcroftTarjanBiconnectedComponents: hopcroftTarjanBiconnected
};
