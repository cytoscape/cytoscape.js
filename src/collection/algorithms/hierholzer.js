import * as is from '../../is';
import { defaults } from '../../util';

const hierholzerDefaults = defaults({
  root: false,
  directed: false
});

let elesfn = ({
  hierholzer: function( options ){
    if (!is.plainObject(options)) {
      let args = arguments;
      options = { root: args[0],   directed: args[1] };
    }
    let { root, directed } = hierholzerDefaults(options);

    let eles = this;
    let dflag = false;
    let oddIn;
    let oddOut;
    let startVertex;
    if (root) startVertex = root.slice(1); // remove #
    let nodes = {}; // nodeId -> [...edgeIds]
    let edges = {}; // edgeId -> [source, target]

    // setup ds for alg and check if not eulerian
    if (directed) {
      eles.forEach(function(ele){
        let id = ele.id();
        if(ele.isNode()) {
          let ind = ele.indegree(true);
          let outd = ele.outdegree(true);
          let d1 = ind - outd;
          let d2 = outd - ind;
          // ensure existence: either all nodes have ind==outd, or
          // exactly one has ind-outd==1 and exactly one has outd-ind==1
          if (d1 == 1) {
            if (oddIn) dflag = true;
            else oddIn = id; // terminal node
          } else if (d2 == 1) {
            if (oddOut) dflag = true;
            else oddOut = id; // startVertex
          } else if ((d2 > 1) || (d1 > 1)) {
            dflag = true;
          }
          // collect the ids of each outgoing edge
          nodes[id] = [];
          ele.outgoers().forEach(e => {
            if (e.isEdge()) nodes[id].push(e.id());
          });
        } else {
          edges[id] = [undefined, ele.target().id()];
        };
      });
    } else {
      eles.forEach(function(ele){
        let id = ele.id();
        if(ele.isNode()) {
          let d = ele.degree(true);
          // ensure existence: more than two vertices with odd degree => not eulerian
          if (d%2) {
            if (!oddIn) oddIn = id;
            else if (!oddOut) oddOut = id;
            else dflag = true;
          };
          nodes[id] = [];
          ele.connectedEdges().forEach(e => nodes[id].push(e.id()));
        } else {
          edges[id] = [ele.source().id(), ele.target().id()];
        };
      });
    };

    let result = {
      pathExists: false,
      circuitExists: false,
      connected: undefined,
      trail: undefined
    };

    // eulerian path/circuit does not exist
    if (dflag) return result;

    // if only an eulerian path exists then oddOut has to be our starting node
    // if an eulerian circuit exists then any starting node can be used
    if (oddOut && oddIn) {
      result.pathExists = true;
      if (directed) {
        // ensure root provided is oddOut
        if (startVertex && (oddOut != startVertex)) {
          return result;
        };
        startVertex = oddOut;
      } else {
        if (startVertex && (oddOut != startVertex) && (oddIn != startVertex)) {
          return result;
        } else if (!startVertex) {
          startVertex = oddOut;
        };
      };
    } else {
      result.circuitExists = true;
      if (!startVertex) startVertex = eles[0].id();
    };

    const walk = (v) => {
      let currentNode = v;
      let subtour = [v];
      let adj, adjTail, adjHead;
      while (nodes[currentNode].length) {
        adj = nodes[currentNode].shift();
        adjTail = edges[adj][0];
        adjHead = edges[adj][1];
        // if adj is not loop, remove other ref to edge
        if (currentNode != adjHead) {
          nodes[adjHead] = nodes[adjHead].filter(e => e != adj);
          currentNode = adjHead;
        } else if (!directed && (currentNode != adjTail)) {
          nodes[adjTail] = nodes[adjTail].filter(e => e != adj);
          currentNode = adjTail;
        };
        subtour.unshift(adj);
        subtour.unshift(currentNode);
      }
      return subtour;
    }

    // generate path/circuit
    let trail = [];
    let subtour = [];
    subtour = walk(startVertex);
    while (subtour.length != 1) {
      if (nodes[subtour[0]].length == 0) {
        trail.unshift(cy.getElementById(subtour.shift()));
        trail.unshift(cy.getElementById(subtour.shift()));
      } else {
        subtour = walk(subtour.shift()).concat(subtour);
      }
    }
    trail.unshift(cy.getElementById(subtour.shift())); // final node

    // check connectedness
    for (let d in nodes) {
      if (nodes[d].length) {
        result.connected = false;
        return result;
      }
    }
    result.connected = true;
    result.trail = this.spawn( trail );
    return result;
  },
});

export default elesfn;
