import { expect } from 'chai';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import cytoscape from '../../src/index.mjs';

/*
Round 43: the debug harness, checked from Node.

`debug/` had no coverage of any kind, and it cost two silent failures at once:

  * round 42 moved the v3 tree to `v3/` and left `debug/networks.js` pointing at
    `../webgl/`, so four of the seven networks 404'd.  The page renders nothing
    when that happens (the fetch rejected with no `.catch`), and nothing in the
    suite noticed.  My round-42 asset check read HTML `src`/`href` attributes,
    which is exactly the wrong shape of check: these URLs are fetched from JS.
  * `sanitizeStyle` had drifted so far behind the style engine that every
    fixture rendered flat and unlabelled — a style regression that no test could
    have caught, because there was no test.

So this spec asserts the two things a headless process actually can:

  1. every fixture a network names **exists on disk** at the path the page will
     ask the server for, and
  2. every network's hand-authored sheet **compiles**, against that fixture's
     real data, through the real `cytoscape()` entry point.

(2) is the valuable half: v4 throws on an unknown style property or a mapper on
a non-mappable channel, so a sheet that has drifted fails here rather than in a
browser nobody opened.

What it deliberately does *not* check is how any of it looks.  That is what
`npm run watch` is for.
*/

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const DEBUG = join(ROOT, 'debug');

/** Load one of the harness's browser globals as a script. */
const loadGlobal = (name) => {
  const src = readFileSync(join(DEBUG, `${name}.js`), 'utf8');
  // the harness's export hook is `if( module && module.exports )`, so the
  // placeholder has to be truthy
  // TextDecoder is a browser global the harness uses to decode packed ids;
  // a bare vm context does not have it, and its absence looks like a code bug
  const ctx = createContext({ module: { exports: {} }, console, TextDecoder });

  runInContext(src, ctx);

  return ctx.module.exports;
};

const networks = loadGlobal('networks');
const fixtures = loadGlobal('fixtures');
const styles = loadGlobal('styles');

/** The path the browser would fetch, resolved against the repo root. */
const fixturePath = (url) => resolve(DEBUG, url);

/** A network's elements, from disk or from the generator. */
const elementsFor = (id, def) => {
  if (def.generated) {
    // the generators are random; a small size keeps the spec quick and still
    // exercises every branch (parents, nesting, compound loops)
    return fixtures.generate(def.generated, '200x400');
  }

  const json = JSON.parse(readFileSync(fixturePath(def.url), 'utf8'));

  return fixtures.derive(def.derive, fixtures.toGpuElements(json.elements));
};

describe('debug harness (round 43)', function () {
  const entries = Object.entries(networks);

  it('offers a non-trivial set of networks', function () {
    // the guard every audit here carries: a loader that stops finding networks
    // must not read as "all networks fine"
    expect(entries.length).to.be.at.least(6);
  });

  describe('every fixture resolves', function () {
    for (const [id, def] of entries) {
      if (def.generated) {
        continue;
      }

      it(`${id} -> ${def.url}`, function () {
        expect(
          existsSync(fixturePath(def.url)),
          `${def.url} does not exist; the page will 404 and render nothing`,
        ).to.equal(true);
      });
    }
  });

  describe('every sheet compiles against its own fixture', function () {
    for (const [id, def] of entries) {
      it(id, function () {
        this.timeout?.(120000);

        const elements = elementsFor(id, def);

        for (const kind of styles.kinds) {
          const sheet = styles.sheet(kind, id, elements, def);

          // headless: no container, so this is the model + style engine only
          const cy = cytoscape({
            elements: { nodes: elements.nodes, edges: elements.edges },
            style: sheet,
          });

          expect(
            cy.nodes().length,
            `${id}/${kind} loaded no nodes`,
          ).to.be.at.least(1);
          cy.destroy();
        }
      });
    }
  });

  describe('the binary wire form round-trips (round 46.5)', function () {
    // The status build ships each fixture as v4's binary wire format rather
    // than JSON — 102.5 MiB becomes 37.5 MiB, which is what puts every fixture
    // under Cloudflare Pages' 25 MiB cap and removes the off-site bucket.  The
    // page then reads it through `fixtures.fromColumnar`.
    //
    // This is the spec that makes that safe: an encoding that silently drops a
    // column would render a *plausible* graph with no labels and no colours,
    // and nothing else would notice.  A first version of `fromColumnar` did
    // exactly that — it read dictionary columns as if they were arrays, so
    // every string column came back `undefined` on every fixture.
    //
    // Control: reading `col[ i ]` for a dict column instead of
    // `col.dict[ col.indices[ i ] - 1 ]` fails 'every data column survives'
    // on all four fixtures.

    const roundTrip = (elements) =>
      fixtures.fromColumnar(
        cytoscape.deserializeElements(
          cytoscape.serializeElements(cytoscape.toColumnarElements(elements)),
        ),
      );

    const norm = (v) =>
      Array.isArray(v) ? v.join('') : v == null ? undefined : String(v);

    for (const [id, def] of entries) {
      if (def.generated || def.derive != null) {
        continue;
      }

      it(`${id}: every data column survives`, function () {
        this.timeout?.(180000);

        const before = elementsFor(id, def);
        const after = roundTrip(before);

        expect(after.nodes.length, 'node count changed').to.equal(
          before.nodes.length,
        );
        expect(after.edges.length, 'edge count changed').to.equal(
          before.edges.length,
        );
        expect(after.hasPositions).to.equal(before.hasPositions);

        // compare a sample rather than all 465k edges: the columns are
        // uniform, so a mismatch shows up in the first few of each kind
        const sample = (a, b, kind) => {
          for (let i = 0; i < Math.min(25, a.length); i++) {
            const keys = new Set([
              ...Object.keys(a[i].data),
              ...Object.keys(b[i].data),
            ]);

            for (const k of keys) {
              expect(
                norm(b[i].data[k]),
                `${kind}[${i}].${k} did not survive`,
              ).to.equal(norm(a[i].data[k]));
            }
          }
        };

        sample(before.nodes, after.nodes, 'node');
        sample(before.edges, after.edges, 'edge');

        // and the whole-column check that a 25-element sample could miss: no
        // column may come back empty for *every* element
        const columns = new Set(
          before.nodes.flatMap((n) => Object.keys(n.data)),
        );

        for (const k of columns) {
          const presentBefore = before.nodes.some((n) => n.data[k] != null);
          const presentAfter = after.nodes.some((n) => n.data[k] != null);

          expect(
            presentAfter,
            `node column "${k}" is empty after the round trip`,
          ).to.equal(presentBefore);
        }
      });
    }

    it('positions survive within f32 precision', function () {
      // the wire format stores positions as f32, so this is a tolerance check
      // rather than an equality one — and the tolerance has to be relative,
      // since these fixtures lay out over tens of thousands of units
      const def = networks['em-web'];
      const before = elementsFor('em-web', def);
      const after = roundTrip(before);

      for (let i = 0; i < before.nodes.length; i++) {
        const a = before.nodes[i].position;
        const b = after.nodes[i].position;

        expect(Math.abs(a.x - b.x)).to.be.at.most(
          Math.max(1e-3, Math.abs(a.x) * 1e-6),
        );
        expect(Math.abs(a.y - b.y)).to.be.at.most(
          Math.max(1e-3, Math.abs(a.y) * 1e-6),
        );
      }
    });

    it('edge endpoints survive, which are indices on the wire and ids in the page', function () {
      // sources/targets are stored as node *indices*; getting the mapping wrong
      // would rewire the graph while keeping every count identical
      const def = networks['white-matter'];
      const before = elementsFor('white-matter', def);
      const after = roundTrip(before);

      for (let i = 0; i < Math.min(200, before.edges.length); i++) {
        expect(after.edges[i].data.source).to.equal(
          before.edges[i].data.source,
        );
        expect(after.edges[i].data.target).to.equal(
          before.edges[i].data.target,
        );
      }
    });
  });

  describe('the v3-demo networks draw what they are named for (round 57.5)', function () {
    // The four demos ported from `v3/documentation/demos/` exist to be looked
    // at, so "the sheet compiles" is not the property that matters — round 43
    // shipped exactly that guarantee and a maintainer found three defects by
    // opening the page a day later.  What *is* checkable here is the failure
    // these demos are most likely to have: a `case` mapper whose clause list
    // has drifted from the fixture's data, so a keyword falls through to the
    // `else` and renders as something else entirely.
    //
    // That is not hypothetical.  Round 56 found four compound arrowheads that
    // had been listed in a golden's scene since round 27.6 and never given a
    // mapper clause, so all four drew as `triangle` — for nine rounds, under a
    // golden that passed the whole time.  These specs are that defect made
    // detectable: every keyword the fixture names must read back as *itself*.

    const load = (id) => {
      const def = networks[id];
      const elements = fixtures.generate(def.generated);

      return {
        elements,
        cy: cytoscape({
          elements: { nodes: elements.nodes, edges: elements.edges },
          style: styles.sheet('production', id, elements, def),
        }),
      };
    };

    it('node-types: every shape keyword resolves to itself', function () {
      const { elements, cy } = load('node-types');
      const wrong = elements.nodes
        .map((n) => [n.data.id, n.data.type, cy.$id(n.data.id).style('shape')])
        .filter(([, want, got]) => got !== want);

      expect(wrong, 'shapes that fell through the case mapper').to.eql([]);
      expect(elements.nodes.length).to.be.at.least(20);
      cy.destroy();
    });

    it('edge-arrows: every arrowhead keyword resolves to itself', function () {
      const { elements, cy } = load('edge-arrows');
      const wrong = elements.edges
        .map((e) => [
          e.data.id,
          e.data.arrow,
          cy.$id(e.data.id).style('target-arrow-shape'),
        ])
        .filter(([, want, got]) => got !== want);

      expect(wrong, 'arrowheads that fell through the case mapper').to.eql([]);

      // and both fills are actually present, which is the comparison the
      // fixture alternates rows to make
      const fills = new Set(
        elements.edges.map((e) => cy.$id(e.data.id).style('target-arrow-fill')),
      );

      expect([...fills].sort()).to.eql(['filled', 'hollow']);
      cy.destroy();
    });

    it('edge-types: every curve-style keyword is reached', function () {
      const { elements, cy } = load('edge-types');
      const got = new Set(
        elements.edges.map((e) => cy.$id(e.data.id).style('curve-style')),
      );

      // `multi-unbundled-bezier` deliberately maps onto `unbundled-bezier` —
      // v4's list-valued curve params are constants-only, so the two rows
      // share one parameterisation (recorded on the sheet)
      expect([...got].sort()).to.eql([
        'bezier',
        'haystack',
        'round-segments',
        'round-taxi',
        'segments',
        'straight',
        'straight-triangle',
        'taxi',
        'unbundled-bezier',
      ]);
      cy.destroy();
    });

    it('labels: the 3x3 anchor grid is fully covered, and rotation reaches one cell', function () {
      const { elements, cy } = load('labels');
      const pairs = elements.nodes
        .filter((n) => n.data.kind === 'align')
        .map(
          (n) =>
            `${cy.$id(n.data.id).style('text-valign')} ${cy.$id(n.data.id).style('text-halign')}`,
        );

      expect(new Set(pairs).size, 'each cell of the grid is distinct').to.equal(
        9,
      );

      // v4 has no `-inside` variants (round 13 D3), so nine is the whole grid
      expect(pairs.sort()).to.eql([
        'bottom center',
        'bottom left',
        'bottom right',
        'center center',
        'center left',
        'center right',
        'top center',
        'top left',
        'top right',
      ]);
      expect(cy.$id('rotated').style('text-rotation')).to.be.closeTo(
        Math.PI / 6,
        1e-6,
      );
      expect(cy.$id('ar').style('text-rotation')).to.equal('autorotate');
      cy.destroy();
    });
  });

  describe('the sheets say what they mean', function () {
    it("labels resolve to the network's own key, not to ids", function () {
      // the defect round 43 fixed: `?labels=true` used to *replace* the sheet's
      // mapping with data(id), which showed UUIDs on em-web and SUIDs on NDEx
      const def = networks['ndex-x-large'];
      const elements = elementsFor('ndex-x-large', def);
      const cy = cytoscape({
        elements: { nodes: elements.nodes.slice(0, 50), edges: [] },
        style: styles.sheet('production', 'ndex-x-large', elements, def),
      });
      const first = cy.nodes()[0];

      expect(first.label(), 'the label fell back to the id').to.not.equal(
        first.id(),
      );
      expect(first.label()).to.equal(first.data('name'));
      cy.destroy();
    });

    it('the EnrichmentMap sheet maps NES to a diverging scale', function () {
      const def = networks['em-web'];
      const elements = elementsFor('em-web', def);
      const cy = cytoscape({
        elements: { nodes: elements.nodes, edges: [] },
        style: styles.sheet('production', 'em-web', elements, def),
      });
      const up = cy.nodes().max((n) => n.data('NES')).ele;
      const down = cy.nodes().min((n) => n.data('NES')).ele;

      // the whole point of the port: one declarative mapper reproduces what
      // EnrichmentMap writes as a memoized per-element function
      expect(up.style('background-color')).to.not.equal(
        down.style('background-color'),
      );
      expect(up.data('NES')).to.be.greaterThan(0);
      expect(down.data('NES')).to.be.lessThan(0);
      cy.destroy();
    });

    it('the compound fixture lays out into disjoint parent boxes', function () {
      // The maintainer's report: the compound fixture "is not laid out like it
      // is in the debug page in v3, making it hard to read".  Two causes, both
      // in this directory — round 43 re-sorted the node list while claiming a
      // verbatim port of `v3/debug/compound.js`, and dropped that page's
      // `cols: 3`.  Grid places leaves in declaration order and parents derive
      // their boxes from where their children land, so between them the
      // families interleaved and n1's auto-box swallowed n2's.
      //
      // The property worth pinning is the readable one rather than the
      // transcription: two parents that are not ancestor and descendant must
      // not overlap.  It fails on either cause alone.
      const def = networks['compound-fixture'];
      const elements = elementsFor('compound-fixture', def);
      const cy = cytoscape({
        elements: { nodes: elements.nodes, edges: elements.edges },
        style: styles.sheet('production', 'compound-fixture', elements, def),
        layout: def.layout,
        // grid picks its column count from the container's aspect ratio when
        // the layout does not say, so a *headless* default (800 x 600) picks 3
        // and the spec passes with `cols` removed — measured, and it is the
        // vacuous-spec trap this repo keeps re-learning.  These are the debug
        // page's real dimensions, where the default is 2.
        headlessWidth: 930,
        headlessHeight: 900,
      });
      const parents = cy.nodes({ parent: true });

      expect(parents.length, 'the fixture stopped being compound').to.equal(4);

      for (let i = 0; i < parents.length; i++) {
        for (let j = i + 1; j < parents.length; j++) {
          const a = parents[i];
          const b = parents[j];

          if (
            a.isAncestorOf?.(b) ||
            b.isAncestorOf?.(a) ||
            a.ancestors().contains(b) ||
            b.ancestors().contains(a)
          ) {
            continue;
          }

          const ba = a.boundingBox();
          const bb = b.boundingBox();
          const overlaps =
            ba.x1 < bb.x2 && bb.x1 < ba.x2 && ba.y1 < bb.y2 && bb.y1 < ba.y2;

          expect(
            overlaps,
            `${a.id()} and ${b.id()} overlap: unrelated parents must not`,
          ).to.equal(false);
        }
      }

      // the parents block overlays the nodes block, so a `shape` mapper on the
      // nodes group reaches parents; v3's `:parent` default is a rectangle and
      // the sheet has to say so
      expect(parents[0].style('shape')).to.equal('rectangle');
      cy.destroy();
    });

    it('the clustered variant really is compound', function () {
      const def = networks['em-web-clustered'];
      const elements = elementsFor('em-web-clustered', def);
      const cy = cytoscape({
        elements: { nodes: elements.nodes, edges: [] },
        style: styles.sheet('production', 'em-web-clustered', elements, def),
      });

      // 41 MCODE clusters over 354 of the 569 nodes, as shipped
      expect(cy.nodes({ parent: true }).length).to.be.at.least(20);
      expect(cy.nodes({ child: true }).length).to.be.at.least(100);
      cy.destroy();
    });
  });

  describe('the event log', function () {
    /* The maintainer's second report: box selection raised Chrome's
       "[Violation] Forced reflow while executing JavaScript took 40ms".
       It was this section, not the library.  `append` used to write a row and
       then read `el.scrollHeight` to keep the view pinned to the bottom, and a
       DOM write followed by a layout read forces a synchronous layout.  Box
       selection emits `box` + `boxselect` + `select` per element, so on em-web
       one gesture cost 22406 forced layouts — measured 5659 ms of layout in a
       6055 ms pointerup handler, against 40 ms with this section's filter off.

       So the property to hold is "the log reads layout once per frame, not
       once per event", which is checkable here with a DOM stub: the real
       failure is a *ratio*, and a ratio does not need a browser. */
    const runEventLog = ({ events, frames }) => {
      const reads = { scrollHeight: 0 };
      const rows = [];
      const raf = [];
      const el = {
        get scrollHeight() {
          reads.scrollHeight++;
          return rows.length * 10;
        },
        set scrollTop(_v) {},
        get childElementCount() {
          return rows.length;
        },
        get firstChild() {
          return rows[0];
        },
        appendChild(n) {
          rows.push(...(n.__frag ?? [n]));
        },
        removeChild(n) {
          rows.splice(rows.indexOf(n), 1);
        },
        set textContent(_v) {
          rows.length = 0;
        },
        addEventListener() {},
        checked: false,
      };
      const node = () => ({ className: '', textContent: '' });
      const handlers = [];
      const ctx = createContext({
        console,
        $: () => el,
        $$: () => [],
        document: {
          createElement: node,
          createDocumentFragment: () => {
            const frag = [];

            return { __frag: frag, appendChild: (n) => frag.push(n) };
          },
        },
        requestAnimationFrame: (fn) => raf.push(fn),
        window: {
          onCy: (fn) =>
            fn({ on: (type, a, b) => handlers.push({ type, fn: b ?? a }) }),
        },
      });

      runInContext(readFileSync(join(DEBUG, 'events.js'), 'utf8'), ctx);

      const target = { id: () => 'n1' };
      // an enabled family and not one of the NOISY names, so nothing gates it
      const handler = handlers.find((h) => h.type === 'tapstart');

      expect(handler, 'events.js stopped registering tapstart').to.not.equal(
        undefined,
      );

      const fire = () => handler.fn({ target });

      for (let f = 0; f < frames; f++) {
        for (let i = 0; i < events; i++) {
          fire();
        }

        for (const fn of raf.splice(0)) {
          fn();
        }
      }

      return { reads, rowCount: rows.length };
    };

    it('reads layout once per frame, not once per event', function () {
      const many = runEventLog({ events: 5000, frames: 1 });

      expect(
        many.reads.scrollHeight,
        '5000 events must not force 5000 layouts',
      ).to.equal(1);
      expect(many.rowCount, 'the visible window is still capped').to.equal(400);

      // the control for the control: the count really does track frames
      const spread = runEventLog({ events: 10, frames: 7 });

      expect(spread.reads.scrollHeight).to.equal(7);
    });
  });

  describe('the dev server the page expects', function () {
    it('binds livereload on every interface', function () {
      // `livereload-setup.js` builds the client URL from `location.hostname`,
      // and `http-server -o` opens the page at 127.0.0.1 — while livereload's
      // own default (`localhost`) resolves to `::1` here and binds only that.
      // The two never met: every reload 404'd with nothing but a console line
      // to say so.  An explicit bind is the fix, and it is one word to lose.
      const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
      const sync = pkg.scripts['watch:sync'];

      expect(sync, 'watch:sync no longer runs livereload').to.match(
        /^livereload\b/,
      );
      expect(
        sync,
        'livereload must not take its localhost-only default bind',
      ).to.match(/(^|\s)(-b|--bind)\s+0\.0\.0\.0(\s|$)/);
    });
  });
});
