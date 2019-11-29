let elesfn = ({
  biconnected: function() {

    let eles = this;
    let nodes = {};
    let id = 0;
    let edgeCount = 0;
    let blocks = [];
    let stack = [];
    let visitedEdges = {};

    const buildBlock = (x, y) => {
      let i = stack.length-1;
      let block = [];
      while (stack[i].x != x || stack[i].y != y) {
        block.push(stack.pop().edge);
        i--;
      }
      block.push(stack.pop().edge);
      blocks.push(this.spawn(block));
    };

    const biconnectedSearch = (root, currentNode, parent) => {
      if (root == parent) edgeCount += 1;
      nodes[currentNode] = {
        id : id,
        low : id++,
        cutVertex : false
      };
      let sourceId, targetId, otherNodeId, edgeId;
      let edges = eles.getElementById(currentNode).connectedEdges();
      edges.forEach(edge => {
        sourceId = edge.source().id();
        targetId = edge.target().id();
        otherNodeId = (sourceId == currentNode) ? targetId : sourceId;
        if ((otherNodeId != currentNode) && (otherNodeId != parent)) {

          edgeId = edge.id();
          if (!visitedEdges[edgeId]) {
            visitedEdges[edgeId] = true;
            stack.push({
              x : currentNode,
              y : otherNodeId,
              edge : this.getElementById(edgeId)
            });
          }

          if (!(otherNodeId in nodes)) {
            biconnectedSearch(root, otherNodeId, currentNode);
            nodes[currentNode].low = Math.min(nodes[currentNode].low, nodes[otherNodeId].low);
            if (nodes[currentNode].id <= nodes[otherNodeId].low) {
              nodes[currentNode].cutVertex = true;
              buildBlock(currentNode, otherNodeId);
            }
          } else {
            nodes[currentNode].low = Math.min(nodes[currentNode].low, nodes[otherNodeId].id);
          }
        }
      });
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
      .map(id => this.getElementById(id));

    return {
      cutVertices: this.spawn(cutVertices),
      components: blocks
    };

  }
});

export default elesfn;
