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
    let oddIn; // first vertex found with ind-outd == 1
    let oddOut; // first vertex found with outd-ind == 1
    let startVertex;
    if (root) startVertex = root.slice(1); // remove #
    let degrees = {}; // id -> array of outgoing edges
    let edges = {}; // nodeId -> {nodeId : Edge}
    // ensure existence of circuit/path
    eles.forEach(function(ele){
      let id = ele.id();
      if(ele.isNode()) {
        let ind = ele.indegree(true);
        let outd = ele.outdegree(true);
        let d1 = ind - outd;
        let d2 = outd - ind;
        if (d1 == 1) {
          if (oddIn) dflag = true;
          else oddIn = id; // terminal node
        } else if (d2 == 1) {
          if (oddOut) dflag = true;
          else oddOut = id; // startVertex
        } else if ((d2 > 1) || (d1 > 1)) {
          dflag = true;
        }
        // collect the ids of each nodes targets
        let outgoing = [];
        cy.$("#"+id).outgoers().forEach(function(v) {
          if (v.isNode()) outgoing.push(v.id());
        });

        // only track non-isolated vertices
        if (ele.degree(true) > 0) {
          degrees[id] = outgoing;
          if (!startVertex) startVertex = id;
        }
      } else {
        // store map of edges by source -> target
        let source = ele.source().id();
        if (!(source in edges)) edges[source] = {};
        edges[source][ele.target().id()] = ele;
      }
    });

    let result = {
      pathExists: false,
      circuitExists: false,
      connected: undefined,
      trail: undefined
    };

    // eulerian path/circuit does not exist
    if (dflag) return result;

    // if eulerian path exists then oddOut has to be our starting node
    // otherwise, eulerian circuit exists and any starting node can be used
    if (oddOut && oddIn) {
      result.pathExists = true;
      // ensure root provided is oddOut
      if (startVertex && (oddOut != startVertex)) {
        return result;
      }
      startVertex = oddOut;
    } else {
      result.circuitExists = true;
    }

    const walk = (v) => {
      let currentNode = v;
      let subtour = [v];
      while (degrees[currentNode].length) {
        subtour.unshift(degrees[currentNode][0]);
        currentNode = degrees[currentNode].shift();
      }
      return subtour;
    }

    // generate path/circuit
    let trail = [];
    let subtour = [];
    subtour = walk(startVertex);
    while (subtour.length != 1) {
      if (degrees[subtour[0]].length == 0) {
        let target = subtour.shift();
        let source = subtour[0];
        trail.unshift(cy.getElementById(target));
        trail.unshift(edges[source][target]);
      } else {
        subtour = walk(subtour.shift()).concat(subtour);
      }
    }
    trail.unshift(cy.getElementById(subtour.shift())); // final node

    // check connectedness
    for (let d in degrees) {
      if (degrees[d].length) {
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
