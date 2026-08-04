import type { Collection, Element, SharedCollection } from '../eles-types.mjs';

/** Result of Tarjan's strongly-connected-components algorithm. */
export interface TarjanStronglyConnectedResult {
  cut: Collection;
  components: Collection[];
}

export interface AlgorithmsTarjanStronglyConnected {
  tarjanStronglyConnected( this: SharedCollection ): TarjanStronglyConnectedResult;
  tsc( this: SharedCollection ): TarjanStronglyConnectedResult;
  tscc( this: SharedCollection ): TarjanStronglyConnectedResult;
  tarjanStronglyConnectedComponents( this: SharedCollection ): TarjanStronglyConnectedResult;
}

/** Per-node bookkeeping kept during the DFS. */
interface NodeInfo {
  index: number;
  low: number;
  explored: boolean;
}

let tarjanStronglyConnected = function( this: SharedCollection ): TarjanStronglyConnectedResult {

  let eles = this as Collection;
  let nodes: Record<string, NodeInfo> = {};
  let index = 0;
  let components: Collection[] = [];
  let stack: string[] = [];
  let cut = eles.spawn(eles);

  const stronglyConnectedSearch = ( sourceNodeId: string ) => {
    stack.push(sourceNodeId);
    nodes[sourceNodeId] = {
      index : index,
      low : index++,
      explored : false
    };

    let connectedEdges = eles.getElementById(sourceNodeId)
                             .connectedEdges()
                             .intersection(eles);

    connectedEdges.forEach(( edge: Element ) => {
      let targetNodeId = edge.target().id()!;
      if (targetNodeId !== sourceNodeId) {
        if (!(targetNodeId in nodes)) {
          stronglyConnectedSearch(targetNodeId);
        }
        if (!(nodes[targetNodeId].explored)) {
          nodes[sourceNodeId].low = Math.min(nodes[sourceNodeId].low,
                                             nodes[targetNodeId].low);
        }
      }
    });

    if (nodes[sourceNodeId].index === nodes[sourceNodeId].low) {
      let componentNodes = eles.spawn();
      for (;;) {
        const nodeId = stack.pop() as string;
        componentNodes.merge(eles.getElementById(nodeId));
        nodes[nodeId].low = nodes[sourceNodeId].index;
        nodes[nodeId].explored = true;
        if (nodeId === sourceNodeId) {
          break;
        }
      }

      let componentEdges = componentNodes.edgesWith(componentNodes);
      let component = componentNodes.merge(componentEdges);
      components.push(component);
      cut = cut.difference(component);
    }
  };

  eles.forEach(( ele: Element ) => {
    if (ele.isNode()) {
      let nodeId = ele.id()!;
      if (!(nodeId in nodes)) {
        stronglyConnectedSearch(nodeId);
      }
    }
  });

  return {
    cut,
    components
  };

};

export default {
  tarjanStronglyConnected,
  tsc: tarjanStronglyConnected,
  tscc: tarjanStronglyConnected,
  tarjanStronglyConnectedComponents: tarjanStronglyConnected
} as AlgorithmsTarjanStronglyConnected;
