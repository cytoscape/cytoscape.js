// Compile-only test for typed element data (round 140, PLAN.md item 45):
// `cytoscape<NodeData, EdgeData>( … )` flows the application's shapes
// through `data()`, the collections and element handles, the events, the
// add/patch/load/clone payloads, the queries and the stylesheet's field
// references.  Run via `npm run test:types`.
//
// Three parts: the untyped rule (no generic → exactly the pre-140 types,
// asserted as type *equality*, not assignability), the typed positives,
// and the typed negatives — each `@ts-expect-error` fails the build if
// the error it names ever stops being one.

import cytoscape from '../../build/dts/index.js';
import headless from '../../build/dts/headless.js';
import headlessGpu from '../../build/dts/headless-gpu.js';
import type {
  Collection,
  Core,
  ElementData,
  ElementDefinition,
  Event,
  EventTarget,
  Mapper,
  PatchDiff,
  Stylesheet,
} from '../../build/dts/index.js';

/** True exactly when A and B are the same type (not merely assignable). */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const exact = <A, B>(proof: Equals<A, B>): Equals<A, B> => proof;

// -- the untyped rule: no generic, exactly today's types --

const plain = cytoscape({
  // elements whose data *could* be inferred from — and must not be: the
  // options take `NoInfer`, so nothing narrows without an explicit generic
  elements: [{ data: { id: 'a', weight: 1 } }],
});

exact<typeof plain, Core>(true);
exact<ReturnType<typeof plain.nodes>, Collection>(true);
exact<ReturnType<typeof plain.getElementById>, Collection>(true);
exact<ReturnType<Collection['first']>, Collection>(true);
exact<Mapper['data'], string>(true);
exact<ElementDefinition['data'], ElementData | undefined>(true);
exact<EventTarget, Core | Collection>(true);
exact<Event['target'], Core | Collection | undefined>(true);
exact<PatchDiff['added'], Collection>(true);

const anyKey = plain.nodes().data('anything');
const anyWhole = plain.nodes().data();

exact<typeof anyKey, unknown>(true);
exact<typeof anyWhole, unknown>(true);

plain.nodes().data('anything', { at: 'all' });
plain.nodes().data({ anything: 1 });
plain.style({ nodes: { width: { data: 'anything', range: [1, 2] } } });
plain.nodes({ data: { anything: { gt: 1 } } });

// the slim entries follow the same rule
exact<ReturnType<typeof headless>, Core>(false); // each entry's own Core
const slimRead = headless().nodes().data('anything');

exact<typeof slimRead, unknown>(true);

// -- the typed positives --

interface NodeData {
  weight: number;
  label: string;
  tier?: 'a' | 'b';
}

interface EdgeData {
  kind: 'activation' | 'inhibition';
  strength: number;
}

const cy = cytoscape<NodeData, EdgeData>({
  elements: {
    nodes: [
      { data: { id: 'n1', weight: 1, label: 'One' } },
      { data: { id: 'n2', weight: 5, label: 'Two', tier: 'a' } },
    ],
    edges: [
      {
        data: {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          kind: 'activation',
          strength: 0.5,
        },
      },
    ],
  },
  style: {
    nodes: {
      width: { data: 'weight', scale: 'sqrt', range: [10, 60] },
      label: { data: 'label' },
      'background-color': {
        case: [{ when: { data: 'tier', eq: 'a' }, then: '#f00' }],
        else: '#999',
      },
    },
    edges: {
      width: { data: 'strength', range: [1, 4] },
      'line-color': {
        case: [{ when: { data: 'kind', eq: 'inhibition' }, then: '#00f' }],
      },
    },
    parents: { 'border-width': { data: 'weight', range: [1, 3] } },
  },
});

// data() reads the field's type; a read can miss, so `undefined` joins it
const weight: number | undefined = cy.nodes().data('weight');
const kind: 'activation' | 'inhibition' | undefined = cy.edges().data('kind');
const nodeId: string | undefined = cy.nodes().data('id');
const wholeNode: NodeData | undefined = cy.nodes().first().data();
const wholeEdge: EdgeData | undefined = cy.edges().eq(0).data();
// a mixed collection reads either shape
const either: NodeData | EdgeData | undefined = cy.elements().data();

exact<typeof weight, number | undefined>(true);
exact<ReturnType<typeof cy.nodes>, Collection<NodeData, EdgeData, NodeData>>(
  true,
);

// writes are typed and chain
const chained: Collection<NodeData, EdgeData, NodeData> = cy
  .nodes()
  .data('weight', 3)
  .data({ label: 'three' });

// traversal keeps the right shape
const edgeKind = cy.nodes().connectedEdges().data('kind');
const sourceWeight = cy.edges().source().data('weight');
const childLabel = cy.nodes().children().data('label');
const mixed = cy.nodes().neighborhood();

exact<typeof edgeKind, 'activation' | 'inhibition' | undefined>(true);
exact<typeof sourceWeight, number | undefined>(true);
exact<typeof childLabel, string | undefined>(true);
exact<typeof mixed, Collection<NodeData, EdgeData>>(true);

// element handles: iteration, callbacks and set operations
for (const node of cy.nodes()) {
  const w: number | undefined = node.data('weight');

  void w;
}

const heavy = cy.nodes().filter((n) => (n.data('weight') ?? 0) > 2);
const total = cy.nodes().reduce((sum, n) => sum + (n.data('weight') ?? 0), 0);
const labels: (string | undefined)[] = cy.nodes().map((n) => n.data('label'));
const both = cy.nodes().union(cy.edges());

exact<typeof heavy, Collection<NodeData, EdgeData, NodeData>>(true);
const bothRead = both.data();

exact<typeof bothRead, NodeData | EdgeData | undefined>(true);

// a typed collection is still a collection: it widens to the mixed and
// the plain types, and every member that takes one takes it
const asMixed: Collection<NodeData, EdgeData> = cy.nodes();
const asPlain: Collection = cy.nodes();
const byPredicate = cy.$((ele) => ele.data('id') !== 'n1');

cy.fit(cy.nodes(), 10);
cy.emphasize(cy.nodes().closedNeighborhood());
cy.remove(cy.edges().filter((e) => e.data('strength') === 0));
exact<typeof byPredicate, Collection<NodeData, EdgeData>>(true);
void [asMixed, asPlain, cy.nodes().edgesWith(cy.nodes())];

// queries name the queried shape's fields
const byQuery = cy.nodes({ data: { weight: { gt: 2 }, tier: 'a' } });
const edgesByQuery = cy.edges({ data: { kind: 'activation' } });

// events: the target and the core carry the shapes
cy.on('tap', (event) => {
  const target = event.target;

  if (target != null && 'isNode' in target) {
    // an element target is either group: narrow it to read a node field
    const label: string | undefined = target.nodes().data('label');
    const id: string | undefined = target.data('id');

    void [label, id];
  }

  const core: Core<NodeData, EdgeData> | undefined = event.cy;

  void core;
});
cy.on(
  'tap',
  (ele) => ele.isNode(),
  (event) => void event.target,
);
cy.nodes().on('position', (event) => void event.target);
void cy.promiseOn('add').then((event) => void event.target);

// payloads: add, patch, load, clone
const added = cy.add({ data: { id: 'n3', weight: 2, label: 'Three' } });
const addedMany = cy.add([
  { data: { id: 'n4', weight: 2, label: 'Four' } },
  {
    data: {
      id: 'e2',
      source: 'n3',
      target: 'n4',
      kind: 'inhibition',
      strength: 1,
    },
  },
]);
const diff = cy.patch({
  nodes: [{ data: { id: 'n1', weight: 9, label: 'One' } }],
});
const patchedWeight: number | undefined = diff.updated.nodes().data('weight');
const run = cy.load([
  { nodes: [{ data: { id: 'n5', weight: 1, label: 'Five' } }] },
]);
const mini = cy.clone({
  style: { nodes: { width: { data: 'weight', range: [2, 6] } } },
});

exact<typeof diff, PatchDiff<NodeData, EdgeData>>(true);
exact<typeof mini, Core<NodeData, EdgeData>>(true);
void cy.ready.then((ready) => ready.nodes().data('weight'));

// a sheet can be written typed, apart from the instance
const sheet: Stylesheet<NodeData, EdgeData> = {
  nodes: { height: { data: 'weight' } },
};

cy.style(sheet);

// the columnar and wire forms stay accepted as they are (untyped by nature)
const typedDefs: ElementDefinition<NodeData>[] = [
  { data: { id: 'c1', weight: 1, label: 'C' } },
];

cy.add(cytoscape.toColumnarElements(typedDefs));
cy.add(cytoscape.toColumnarElements([{ data: { id: 'n6' } }]));

// the slim entries take the generics too
const cyHeadless = headless<NodeData, EdgeData>({
  elements: [{ data: { id: 'h', weight: 1, label: 'H' } }],
});
const headlessWeight: number | undefined = cyHeadless.nodes().data('weight');
const gpuKind = headlessGpu<NodeData, EdgeData>().edges().data('kind');

exact<typeof gpuKind, 'activation' | 'inhibition' | undefined>(true);

// typing the nodes alone leaves the edges' keys open (and typed)
const nodesOnly = cytoscape<NodeData>();
const freeEdge = nodesOnly.edges().data('anything');
const typedNode = nodesOnly.nodes().data('weight');

exact<typeof freeEdge, unknown>(true);
exact<typeof typedNode, number | undefined>(true);

// -- the typed negatives --

// @ts-expect-error a key the node shape does not have
cy.nodes().data('wieght');
// @ts-expect-error an edge field read from nodes
cy.nodes().data('kind');
// @ts-expect-error the wrong value type for the field
cy.nodes().data('weight', 'heavy');
// @ts-expect-error the wrong value type in a patch
cy.nodes().data({ weight: 'heavy' });
// @ts-expect-error nor may a patch name a missing field
cy.edges().data({ label: 'x' });
cytoscape<NodeData, EdgeData>({
  // @ts-expect-error a mapper naming a field the nodes do not have
  style: { nodes: { width: { data: 'kind' } } },
});
cytoscape<NodeData, EdgeData>({
  // @ts-expect-error an edge mapper naming a node field
  style: { edges: { width: { data: 'weight', range: [1, 2] } } },
});
cy.style({
  nodes: {
    'background-color': {
      // @ts-expect-error a case condition naming a missing field
      case: [{ when: { data: 'tierr', eq: 'a' }, then: '#f00' }],
    },
  },
});
cytoscape<NodeData, EdgeData>({
  elements: {
    // @ts-expect-error a node definition with a misspelt field
    nodes: [{ data: { id: 'x', wieght: 1, label: 'X' } }],
  },
});
cytoscape<NodeData, EdgeData>({
  // @ts-expect-error a node definition with the wrong field type
  elements: {
    nodes: [{ data: { id: 'x', weight: 'one', label: 'X' } }],
  },
});
// @ts-expect-error an added node missing a required field
cy.add({ data: { id: 'y', weight: 1 } });
// @ts-expect-error a patch whose edge has an unknown kind
cy.patch({ edges: [{ data: { id: 'e', kind: 'unknown', strength: 1 } }] });
// @ts-expect-error a load chunk with a misspelt field
cy.load([{ nodes: [{ data: { id: 'z', weight: 1, lable: 'Z' } }] }]);
// @ts-expect-error a clone's sheet naming a missing field
cy.clone({ style: { nodes: { width: { data: 'size' } } } });
// @ts-expect-error a query naming a missing field
cy.nodes({ data: { wieght: { gt: 1 } } });
// @ts-expect-error a typed collection's data is not an arbitrary string key
cyHeadless.nodes().data('anything');
// @ts-expect-error a mixed collection reads only the fields both shapes share
cy.elements().data('weight');
// @ts-expect-error a first-class field is read-only
cy.edges().data('source', 'n2');

void [
  chained,
  weight,
  kind,
  nodeId,
  wholeNode,
  wholeEdge,
  either,
  total,
  labels,
  byQuery,
  edgesByQuery,
  added,
  addedMany,
  patchedWeight,
  run,
  headlessWeight,
];
