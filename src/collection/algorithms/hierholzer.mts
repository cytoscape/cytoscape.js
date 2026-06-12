import * as is from '../../is.mjs';
import { defaults } from '../../util/index.mjs';
import type { Collection, Element } from '../eles-types.mjs';

/** Options accepted by `hierholzer`. */
export interface HierholzerOptions {
  root?: Collection | Element | string;
  directed?: boolean;
}

/** Result of `hierholzer`: an Eulerian trail, if one exists. */
export interface HierholzerResult {
  found: boolean;
  trail: Collection | undefined;
}

export interface AlgorithmsHierholzer {
  hierholzer(
    this: Collection,
    options?: HierholzerOptions | Collection | Element | string,
    directed?: boolean
  ): HierholzerResult;
}

const hierholzerDefaults = defaults({
  root: undefined as Collection | Element | string | undefined,
  directed: false
});

let elesfn = ({
  hierholzer: function(
    this: Collection,
    options?: HierholzerOptions | Collection | Element | string,
    directed?: boolean
  ): HierholzerResult {
    let opts: HierholzerOptions;
    if (!is.plainObject(options)) {
      // mirror the original `arguments`-based positional handling: options as root, directed as directed
      opts = { root: options as Collection | Element | string, directed };
    } else {
      opts = options as HierholzerOptions;
    }
    let { root, directed: dir } = hierholzerDefaults(opts);
    let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias
    let dflag = false;
    let oddIn: string | undefined;
    let oddOut: string | undefined;
    let startVertex: string | undefined;
    if (root) startVertex = is.string(root) ? this.filter(root)[0].id() : ( root as Collection )[0].id();
    let nodes: Record<string, string[]> = {};
    let edges: Record<string, [ string | undefined, string ]> = {};

    if (dir) {
      eles.forEach(function( ele: Element ){
        let id = ele.id()!;
        if(ele.isNode()) {
          let ind = ele.indegree(true)!;
          let outd = ele.outdegree(true)!;
          let d1 = ind - outd;
          let d2 = outd - ind;
          if (d1 == 1) {
            if (oddIn) dflag = true;
            else oddIn = id;
          } else if (d2 == 1) {
            if (oddOut) dflag = true;
            else oddOut = id;
          } else if ((d2 > 1) || (d1 > 1)) {
            dflag = true;
          }
          nodes[id] = [];
          ele.outgoers().forEach(( e: Element ) => {
            if (e.isEdge()) nodes[id].push(e.id()!);
          });
        } else {
          edges[id] = [undefined, ele.target().id()!];
        }
      });
    } else {
      eles.forEach(function( ele: Element ){
        let id = ele.id()!;
        if(ele.isNode()) {
          let d = ele.degree(true)!;
          if (d%2) {
            if (!oddIn) oddIn = id;
            else if (!oddOut) oddOut = id;
            else dflag = true;
          }
          nodes[id] = [];
          ele.connectedEdges().forEach(( e: Element ) => nodes[id].push(e.id()!));
        } else {
          edges[id] = [ele.source().id(), ele.target().id()!];
        }
      });
    }

    let result: HierholzerResult = {
      found: false,
      trail: undefined
    };

    if (dflag) return result;
    else if (oddOut && oddIn) {
      if (dir) {
        if (startVertex && (oddOut != startVertex)) {
          return result;
        }
        startVertex = oddOut;
      } else {
        if (startVertex && (oddOut != startVertex) && (oddIn != startVertex)) {
          return result;
        } else if (!startVertex) {
          startVertex = oddOut;
        }
      }
    } else {
      if (!startVertex) startVertex = eles[0].id();
    }

    const walk = ( v: string ): string[] => {
      let currentNode = v;
      let subtour = [v];
      let adj: string, adjTail: string | undefined, adjHead: string;
      while (nodes[currentNode].length) {
        adj = nodes[currentNode].shift() as string;
        adjTail = edges[adj][0];
        adjHead = edges[adj][1];
        if (currentNode != adjHead) {
          nodes[adjHead] = nodes[adjHead].filter(( e: string ) => e != adj);
          currentNode = adjHead;
        } else if (!dir && (currentNode != adjTail)) {
          nodes[adjTail as string] = nodes[adjTail as string].filter(( e: string ) => e != adj);
          currentNode = adjTail as string;
        }
        subtour.unshift(adj);
        subtour.unshift(currentNode);
      }
      return subtour;
    };

    let trail: Collection[] = [];
    let subtour: string[] = [];
    subtour = walk(startVertex as string);
    while (subtour.length != 1) {
      if (nodes[subtour[0]].length == 0) {
        trail.unshift(eles.getElementById(subtour.shift() as string));
        trail.unshift(eles.getElementById(subtour.shift() as string));
      } else {
        subtour = walk(subtour.shift() as string).concat(subtour);
      }
    }
    trail.unshift(eles.getElementById(subtour.shift() as string)); // final node

    for (let d in nodes) {
      if (nodes[d].length) {
        return result;
      }
    }
    result.found = true;
    result.trail = this.spawn( trail, true );
    return result;
  },
}) satisfies AlgorithmsHierholzer;

export default elesfn as AlgorithmsHierholzer;
