import type { Collection, Element, SharedCollection } from '../eles-types.mjs';

/** Result of the Hopcroft-Tarjan biconnected-components algorithm. */
export interface HopcroftTarjanBiconnectedResult {
  cut: Collection;
  components: Collection[];
}

export interface AlgorithmsHopcroftTarjanBiconnected {
  hopcroftTarjanBiconnected( this: SharedCollection ): HopcroftTarjanBiconnectedResult;
  htbc( this: SharedCollection ): HopcroftTarjanBiconnectedResult;
  htb( this: SharedCollection ): HopcroftTarjanBiconnectedResult;
  hopcroftTarjanBiconnectedComponents( this: SharedCollection ): HopcroftTarjanBiconnectedResult;
}

/** Per-node bookkeeping kept during the DFS. */
interface NodeInfo {
  id: number;
  low: number;
  cutVertex: boolean;
}

/** A stack entry recording the edge between nodes x and y. */
interface StackEntry {
  x: string;
  y: string;
  edge: Element;
}

let hopcroftTarjanBiconnected = function( this: SharedCollection ): HopcroftTarjanBiconnectedResult {
  let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias
  let nodes: Record<string, NodeInfo> = {};
  let id = 0;
  let edgeCount = 0;
  let components: Collection[] = [];
  let stack: StackEntry[] = [];
  let visitedEdges: Record<string, boolean> = {};

  const buildComponent = ( x: string, y: string ) => {
    let i = stack.length-1;
    let cutset: Element[] = [];
    let component = eles.spawn();

    while (stack[i].x != x || stack[i].y != y) {
      cutset.push((stack.pop() as StackEntry).edge);
      i--;
    }
    cutset.push((stack.pop() as StackEntry).edge);

    cutset.forEach(( edge: Element ) => {
      let connectedNodes = edge.connectedNodes()
                               .intersection(eles);
      component.merge(edge);
      connectedNodes.forEach(( node: Element ) => {
        const nodeId = node.id()!;
        const connectedEdges = node.connectedEdges()
                                   .intersection(eles);
        component.merge(node);
        if (!nodes[nodeId].cutVertex) {
          component.merge(connectedEdges);
        } else {
          component.merge(connectedEdges.filter(( edge: Element ) => edge.isLoop()));
        }
      });
    });
    components.push(component);
  };

  const biconnectedSearch = ( root: string, currentNode: string, parent?: string ) => {
    if (root === parent) edgeCount += 1;
    nodes[currentNode] = {
      id : id,
      low : id++,
      cutVertex : false
    };
    let edges = eles.getElementById(currentNode)
                    .connectedEdges()
                    .intersection(eles);

    if (edges.size() === 0) {
      components.push(eles.spawn(eles.getElementById(currentNode)));
    } else {
      let sourceId: string, targetId: string, otherNodeId: string, edgeId: string;

      edges.forEach(( edge: Element ) => {
        sourceId = edge.source().id()!;
        targetId = edge.target().id()!;
        otherNodeId = (sourceId === currentNode) ? targetId : sourceId;

        if (otherNodeId !== parent) {
          edgeId = edge.id()!;

          if (!visitedEdges[edgeId]) {
            visitedEdges[edgeId] = true;
            stack.push({
              x : currentNode,
              y : otherNodeId,
              edge
            });
          }

          if (!(otherNodeId in nodes)) {
            biconnectedSearch(root, otherNodeId, currentNode);
            nodes[currentNode].low = Math.min(nodes[currentNode].low,
                                              nodes[otherNodeId].low);

            if (nodes[currentNode].id <= nodes[otherNodeId].low) {
              nodes[currentNode].cutVertex = true;
              buildComponent(currentNode, otherNodeId);
            }
          } else {
            nodes[currentNode].low = Math.min(nodes[currentNode].low,
                                              nodes[otherNodeId].id);
          }
        }
      });
    }
  };

  eles.forEach(( ele: Element ) => {
    if (ele.isNode()) {
      let nodeId = ele.id()!;

      if (!(nodeId in nodes)) {
        edgeCount = 0;
        biconnectedSearch(nodeId, nodeId);
        nodes[nodeId].cutVertex = (edgeCount > 1);
      }
    }
  });

  let cutVertices = Object.keys(nodes)
    .filter(( id: string ) => nodes[id].cutVertex)
    .map(( id: string ) => eles.getElementById(id));

  return {
    cut: eles.spawn(cutVertices),
    components
  };
};

export default {
  hopcroftTarjanBiconnected,
  htbc: hopcroftTarjanBiconnected,
  htb: hopcroftTarjanBiconnected,
  hopcroftTarjanBiconnectedComponents: hopcroftTarjanBiconnected
} as AlgorithmsHopcroftTarjanBiconnected;
