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
const loadError = loadGlobal('load-error');

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

  describe('a failed load names the right suspect', function () {
    // Why this exists: `init.js` used to call `loadNetwork` *inside* the
    // fixture's promise chain, so the `.catch` written for the fetch also
    // caught every error the library threw — and for a network loaded from the
    // binary wire form it reported them all as "a decode failure means the
    // buffer and the library disagree — rebuild the site".  The generated
    // networks, which are built outside any promise, showed the real error.
    // So a WebGPU failure read as "the binary networks are broken and the
    // built-in ones are fine", which is how it was reported.
    //
    // The phase is therefore passed in by the caller that knows it, and these
    // specs pin what each phase may and may not say.
    //
    // Control: making `hint()` return the wire-decode text for every phase
    // fails 'an init failure does not blame the fixture', 'a file:// page is
    // diagnosed as a file:// page' and both http specs.
    const { describeLoadFailure } = loadError;

    const wire = (phase, over = {}) =>
      describeLoadFailure({
        phase,
        networkID: 'em-web',
        url: '../v3/debug/webgl/network-em-web.cyge',
        isWire: true,
        protocol: 'http:',
        error: new Error('boom'),
        ...over,
      });

    it('an init failure does not blame the fixture', function () {
      const text = wire('init', {
        error: new Error(
          'WebGPU is available but no adapter could be acquired; the GPU may be blocklisted',
        ),
        counts: { nodes: 569, edges: 6899 },
      });

      expect(text).to.contain('no adapter could be acquired');
      expect(text).to.contain('569 nodes, 6899 edges');
      expect(text).to.contain('The data is not the suspect');
      // the three things the old message said, and each one was wrong here
      expect(text).to.not.contain('decode');
      expect(text).to.not.contain('npm run status');
      expect(text).to.not.contain('.cyge');
    });

    it('a decode failure does blame the buffer, and says how to fix it', function () {
      const text = wire('decode', {
        error: new Error('Unsupported serialized elements version 9'),
      });

      expect(text).to.contain('Unsupported serialized elements version 9');
      expect(text).to.contain('.cyge');
      expect(text).to.contain('npm run status');
    });

    it('a file:// page is diagnosed as a file:// page', function () {
      // opening status/debug/index.html from disk breaks every fetched network
      // and nothing else — the exact symptom this whole suite is about
      const text = wire('network', {
        protocol: 'file:',
        error: new TypeError('Failed to fetch'),
      });

      expect(text).to.contain('file://');
      expect(text).to.contain('only the generated ones work');
      expect(text).to.contain('npm run status:serve');
      expect(text).to.not.contain('rebuild');
    });

    it('a 404 on the wire form points at the manifest that named it', function () {
      const text = wire('http', {
        error: new Error('404 Not Found for network-em-web.cyge'),
      });

      expect(text).to.contain('404 Not Found');
      expect(text).to.contain('status-config.js');
    });

    it('a 404 on the JSON form points at where the fixtures live', function () {
      const text = describeLoadFailure({
        phase: 'http',
        networkID: 'em-web',
        url: '../v3/debug/webgl/network-em-web.json',
        isWire: false,
        protocol: 'http:',
        error: new Error('404 Not Found'),
      });

      expect(text).to.contain('v3/debug/webgl/');
      expect(text).to.contain('npm run watch');
      expect(text).to.not.contain('.cyge');
    });

    it('every phase carries the error and names the network', function () {
      for (const phase of ['network', 'http', 'decode', 'init']) {
        const text = wire(phase);

        expect(text, phase).to.contain('boom');
        expect(text, phase).to.contain('em-web');
      }
    });

    it('init.js routes all four phases, rather than one catch for the lot', function () {
      // A headless process cannot open the page, so this is a text check — the
      // same trade the dev-server spec below makes.  It is worth having because
      // a correct classifier is useless if the caller collapses back to a
      // single `.catch( fail )`, which is precisely the defect that was here.
      const src = readFileSync(join(DEBUG, 'init.js'), 'utf8');

      for (const phase of ['network', 'http', 'decode']) {
        expect(src, phase).to.contain(`'${phase}'`);
      }

      expect(src).to.contain(`describe('init'`);
      // the stats overlay must not be able to erase a fatal message: it wrote
      // `#stats` every 500 ms, so the adapter error was visible for half a
      // second and then replaced by plausible-looking counts
      expect(src).to.not.contain(`$('#stats').textContent =\n`);
      expect(src.match(/showStats\(/g) || []).to.have.length.at.least(1);
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

  describe('the two style rules (round 57.11)', function () {
    // The maintainer's rules, v3's own philosophy: the default style is
    // minimal and carries the affordances (grey bodies, selection blue, the
    // press overlay), and a custom sheet may restyle anything but must not
    // bury them.

    it("the 'default' kind is the default stylesheet — an empty sheet", function () {
      const empty = { nodes: [], edges: [] };

      for (const [id, def] of entries) {
        expect(styles.sheet('default', id, empty, def), id).to.eql({});
        // 'plain' was the pre-57.11 name; old URLs must keep resolving
        expect(styles.sheet('plain', id, empty, def), `${id} (legacy)`).to.eql(
          {},
        );
      }
    });

    describe('no production sheet buries selection', function () {
      // Selection blue is a *default-sheet* conditional, so a sheet naming a
      // colour channel replaces it — precisely v3's precedence, where the
      // default `:selected` block loses to any later block naming the same
      // property.  Every sheet must re-state selection somewhere visible: on
      // the colour itself, on a border, on an underlay.  The check is
      // behavioural rather than structural: select an element, and the
      // computed style must change.  A tiny dataless graph suffices — the
      // selected clause sits ahead of every data clause, and data mappers
      // fall to their fallbacks without affecting it.
      for (const [id, def] of entries) {
        it(id, function () {
          this.timeout?.(120000);

          // real elements, because the demo sheets derive their case-clause
          // lists from the fixture's data — the *instance* below stays tiny
          const sheet = styles.sheet(
            'production',
            id,
            elementsFor(id, def),
            def,
          );
          const cy = cytoscape({
            elements: {
              nodes: [{ data: { id: 'n1' } }, { data: { id: 'n2' } }],
              edges: [{ data: { id: 'e1', source: 'n1', target: 'n2' } }],
            },
            style: sheet,
          });

          for (const ele of [cy.$id('n1'), cy.$id('e1')]) {
            const what = ele.isNode() ? 'node' : 'edge';
            const before = JSON.stringify(ele.style());

            ele.select();

            const after = JSON.stringify(ele.style());

            expect(
              after,
              `${id}: selecting a ${what} changes nothing visible`,
            ).to.not.equal(before);
            ele.unselect();
          }

          cy.destroy();
        });
      }
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

    it('the compound fixture fits to screen: exact zoom, centered', function () {
      // The maintainer's round-92 report: the compound fixture "does not
      // fit to screen properly".  Round 54's directional compound-loop
      // slack over-framed the fit 1.23x, and because it grew up-left
      // only, `fit` (which centers the box it is given) sat the graph
      // visibly down-right — measured margins 194/30 left/right and
      // 254/89 top/bottom at zoom 0.874 against an exact-box 1.077.
      // The box-bounded kinds read the exact memoized curve bb now, so
      // the fit is the exact box's fit, centered.  The centering
      // assertion is the spec the asymmetry defect was missing all
      // along: reintroduce a one-sided conservative term and it goes
      // red while a zoom-only assertion could stay green under a
      // symmetric cushion.
      const def = networks['compound-fixture'];
      const elements = elementsFor('compound-fixture', def);
      const cy = cytoscape({
        elements: { nodes: elements.nodes, edges: elements.edges },
        style: styles.sheet('production', 'compound-fixture', elements, def),
        layout: def.layout,
        // the debug page's real dimensions — the 43.12 trap: a fit spec
        // that reads cy.width()/height() at the headless default is
        // testing a different graph than the one that broke
        headlessWidth: 930,
        headlessHeight: 900,
      });

      cy.fit(undefined, 30);

      const zoom = cy.zoom();
      const pan = cy.pan();
      const exact = cy.elements().boundingBox();
      const exactZoom = Math.min((930 - 60) / exact.w, (900 - 60) / exact.h);

      // the fixture measured 0.874 before round 92 — a 1.23x over-frame
      expect(zoom, 'fit zoom is the exact box fit').to.be.closeTo(
        exactZoom,
        0.001,
      );
      expect(zoom).to.be.greaterThan(1); // 1.077 as measured

      // centered: the exact box's rendered margins match side to side
      const left = exact.x1 * zoom + pan.x;
      const right = 930 - (exact.x2 * zoom + pan.x);
      const top = exact.y1 * zoom + pan.y;
      const bottom = 900 - (exact.y2 * zoom + pan.y);

      expect(left, 'left vs right margin').to.be.closeTo(right, 3);
      expect(top, 'top vs bottom margin').to.be.closeTo(bottom, 3);

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

  describe('the core toggles', function () {
    /* Round 89.4 added a `pointerCursors` checkbox, and the failure mode a
       new control has is silent: `boolControl` returns early when its
       selector matches nothing, so a typo'd id — or a control added to
       `toggles.js` and forgotten in `index.html` — is a checkbox that
       simply never appears and never fires.  Nothing in the page says so.

       So the property to hold is that every selector `toggles.js` reaches
       for exists in the markup, and that every control it wires names a
       core member that exists on a real instance.  Both are text checks
       against the page's own sources, which is what a headless process
       can honestly do here. */
    const togglesSrc = readFileSync(join(DEBUG, 'toggles.js'), 'utf8');
    const html = readFileSync(join(DEBUG, 'index.html'), 'utf8');

    it('wires every control to an element the page actually has', function () {
      // every selector literal the file names, whether it goes straight to
      // `$()` or through one of the three control factories
      const ids = [...togglesSrc.matchAll(/'#([\w-]+)'/g)].map((m) => m[1]);

      expect(
        ids.length,
        'toggles.js stopped naming any control',
      ).to.be.at.least(14);
      expect(ids, 'the round-89 checkbox').to.include('pointer-cursors-check');

      for (const id of ids) {
        expect(html, `#${id} is wired but not in index.html`).to.include(
          `id="${id}"`,
        );
      }
    });

    it('names only core members that exist', function () {
      // the getter half of each control, `(cy) => cy.<member>(...)`
      const members = new Set(
        [...togglesSrc.matchAll(/\(cy\) => cy\.(\w+)\(/g)].map((m) => m[1]),
      );
      const cy = cytoscape();

      expect(members.has('pointerCursors'), 'the round-89 toggle').to.equal(
        true,
      );

      for (const name of members) {
        expect(typeof cy[name], `cy.${name} is wired but absent`).to.equal(
          'function',
        );
      }

      cy.destroy();
    });
  });

  describe("the v3-default sheet's per-edge curve arrays (round 96)", function () {
    /*
    v3 gives four of this graph's edges their own curve arrays
    (`v3/debug/init.js`): `ab` its control-point lists, `bc`, `ed` and
    `eh` their three different segment lists.  v4's list-valued curve
    props take constants only (the recorded 12b scope note), so the port
    carried one parameterisation per family and recorded the deviation —
    which is what the maintainer saw on `?network=v3-default`: `eh` drew
    a two-segment S where v3 draws a three-segment flat-top.  Round 63's
    `bypasses` section closes it: a bypass entry is a per-element
    constant, which is exactly what a per-edge array is, so for the list
    props it is the *only* per-edge spelling.

    The numbers are hard-coded from the round-96 probe: both libraries
    loaded on `playwright-page/parity.html` with these exact positions
    and parameters, and for `ed` and `eh` (ellipse endpoints) v3 and v4
    agreed **to the last float** — so the `ed`/`eh` values below are
    v3's own.  `ab`/`bc` route through node `b`, a round-hexagon, whose
    boundary v4 approximates by its inscribed ellipse (the ledgered
    deviation in `playwright-tests/lib/routing-ledger.mjs`); their
    interior points sat within 0.9 model px of v3's in the same probe,
    and the values pinned here are v4's own.

    The layout is the page's (`grid`, cols 3) with the bounding box the
    page gets from its viewport pinned explicitly, so the positions —
    and with them every number below — are deterministic headless.

    Control (run once, 2026-08-28): with the sheet's `bypasses` section
    deleted, all four edges fail — which is why the sheet's shared
    family constants are deliberately distinct from every bypass entry.
    */

    const closeTo = (p, [x, y], what) => {
      expect(p, `${what} is missing`).to.exist;
      expect(p.x, `${what}.x`).to.be.closeTo(x, 1e-9);
      expect(p.y, `${what}.y`).to.be.closeTo(y, 1e-9);
    };

    const ROUTES = {
      // v3's values, matched exactly (ellipse endpoints, no approximation)
      ed: {
        seg: [[400, 400]],
        src: [581.6642425845017, 309.16787870774914],
        tgt: [218.33575741549828, 309.16787870774914],
        mid: [400, 400],
      },
      eh: {
        seg: [
          [650, 360.25],
          [650, 400],
          [650, 439.75],
        ],
        src: [613.0915604122578, 315.77533029677056],
        tgt: [613.0915604122578, 484.22466970322944],
        mid: [650, 400],
      },
      // v4's values, within 0.9 model px of v3's (inscribed-ellipse tier)
      ab: {
        ctrl: [
          [307.25, 120],
          [394, 0],
          [480.75, 120],
        ],
        mid: [394, 30],
      },
      bc: {
        seg: [
          [696.25, 120],
          [760, 20],
        ],
        mid: [728.125, 70],
      },
    };

    it("eh/ed/bc/ab route with v3's arrays, not the family defaults", function () {
      this.timeout?.(120000);

      const def = networks['v3-default'];
      const elements = elementsFor('v3-default', def);
      const sheet = styles.sheet('production', 'v3-default', elements, def);

      expect(
        sheet.bypasses,
        'the v3-default sheet lost its bypasses section',
      ).to.have.keys(['ab', 'bc', 'ed', 'eh']);

      const cy = cytoscape({
        elements: { nodes: elements.nodes, edges: elements.edges },
        style: sheet,
      });

      cy.layout({
        name: 'grid',
        cols: 3,
        fit: false,
        boundingBox: { x1: 0, y1: 0, w: 1200, h: 600 },
      }).run();

      for (const [id, want] of Object.entries(ROUTES)) {
        const e = cy.$id(id);
        const pts = want.ctrl ? e.controlPoints() : e.segmentPoints();
        const kind = want.ctrl ? 'controlPoints' : 'segmentPoints';
        const wantPts = want.ctrl ?? want.seg;

        expect(pts, `${id}.${kind}()`).to.have.length(wantPts.length);
        wantPts.forEach((p, i) => closeTo(pts[i], p, `${id}.${kind}()[${i}]`));

        closeTo(e.midpoint(), want.mid, `${id}.midpoint()`);

        if (want.src) {
          closeTo(e.sourceEndpoint(), want.src, `${id}.sourceEndpoint()`);
          closeTo(e.targetEndpoint(), want.tgt, `${id}.targetEndpoint()`);
        }
      }

      cy.destroy();
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

  describe('the layout section (round 114.7)', function () {
    /* The panel's pure parts moved to layout-config.js and spiral-layout.js
       so this spec can run them: the curve-style table Apply re-applies
       the sheet with, the load snapshot Preset restores, how the two force
       checkboxes spell a run, the hover gate — and the extension-contract
       example itself, headless against the real library. */
    const layoutConfig = loadGlobal('layout-config');
    const SpiralLayout = loadGlobal('spiral-layout');
    const html = readFileSync(join(DEBUG, 'index.html'), 'utf8');
    const initSrc = readFileSync(join(DEBUG, 'init.js'), 'utf8');

    const selectValues = () => {
      const at = html.indexOf('id="layout-select"');
      const block = html.slice(at, html.indexOf('</select>', at));

      return [...block.matchAll(/value="([^"]*)"/g)]
        .map((m) => m[1])
        .filter((v) => v !== '');
    };

    it('the edge table names every layout in the select, and only those', function () {
      const inSelect = selectValues();

      expect(inSelect.length).to.be.at.least(10);
      expect(Object.keys(layoutConfig.EDGE_STYLE).sort()).to.deep.equal(
        [...inSelect].sort(),
      );
      // the sheet's own is an explicit decision, not an omission
      expect(layoutConfig.EDGE_STYLE.preset).to.equal(null);
      expect(layoutConfig.EDGE_STYLE.random).to.equal(null);
    });

    it('every override compiles as a sheet, and the layered ones take the direction', function () {
      for (const name of selectValues()) {
        const override = layoutConfig.edgeOverride(name, {
          direction: 'rightward',
        });

        if (override == null) {
          continue;
        }

        // a typo'd keyword fails here, not in a browser nobody opened
        const cy = cytoscape({
          elements: [
            { data: { id: 'a' } },
            { data: { id: 'b' } },
            { data: { id: 'ab', source: 'a', target: 'b' } },
          ],
          style: { edges: override },
        });

        expect(cy.$id('ab').style('curve-style')).to.equal(
          override['curve-style'],
        );
        cy.destroy();
      }

      expect(
        layoutConfig.edgeOverride('flow', { direction: 'rightward' }),
      ).to.deep.equal({
        'curve-style': 'round-taxi',
        'taxi-turn': 20,
        'taxi-direction': 'rightward',
      });
      expect(
        layoutConfig.edgeOverride('breadthfirst')['taxi-direction'],
      ).to.equal('downward');
      // haystack draws no arrows: under ?arrows=true force reads straight
      expect(layoutConfig.edgeOverride('force')['curve-style']).to.equal(
        'haystack',
      );
      expect(
        layoutConfig.edgeOverride('force', { arrows: true })['curve-style'],
      ).to.equal('straight');
    });

    it('sheetWith lays the override over the edge block and keeps the rest', function () {
      const sheet = {
        nodes: { width: 9 },
        edges: { width: 2, 'curve-style': 'haystack' },
      };
      const out = layoutConfig.sheetWith(sheet, { 'curve-style': 'bezier' });

      expect(out.nodes).to.equal(sheet.nodes);
      expect(out.edges).to.deep.equal({ width: 2, 'curve-style': 'bezier' });
      expect(sheet.edges['curve-style'], 'the sheet is not mutated').to.equal(
        'haystack',
      );
    });

    it('the load snapshot restores every leaf through preset; later nodes keep their place', function () {
      const cy = cytoscape({
        headlessWidth: 400,
        headlessHeight: 400,
        elements: [
          { data: { id: 'p' } },
          { data: { id: 'a', parent: 'p' } },
          { data: { id: 'b', parent: 'p' } },
          { data: { id: 'c' } },
        ],
        layout: { name: 'grid' },
      });
      const snapshot = layoutConfig.snapshotPositions(cy);

      // leaves only: the parent derives
      expect(Object.keys(snapshot).sort()).to.deep.equal(['a', 'b', 'c']);

      cy.layout({ name: 'random' }).run();
      cy.add({ data: { id: 'd' }, position: { x: 7, y: 8 } });
      cy.layout(
        layoutConfig.layoutOptions('preset', { positions: snapshot }),
      ).run();

      for (const id of ['a', 'b', 'c']) {
        expect(cy.$id(id).position().x, id).to.be.closeTo(snapshot[id].x, 1e-6);
        expect(cy.$id(id).position().y, id).to.be.closeTo(snapshot[id].y, 1e-6);
      }

      expect(cy.$id('d').position()).to.deep.equal({ x: 7, y: 8 });
    });

    it('control: an empty snapshot moves nothing', function () {
      const cy = cytoscape({
        elements: [{ data: { id: 'a' }, position: { x: 3, y: 4 } }],
      });

      cy.layout(layoutConfig.layoutOptions('preset', {})).run();
      expect(cy.$id('a').position()).to.deep.equal({ x: 3, y: 4 });
    });

    it('spells the force run from the two checkboxes, and the rest from one', function () {
      expect(layoutConfig.forceAnimation({ animate: true })).to.deep.equal({
        animate: true,
      });
      expect(layoutConfig.forceAnimation({ animate: false })).to.deep.equal({
        animate: false,
      });
      // Live wins over Animate: a streamed run lands its settle in one write
      expect(
        layoutConfig.forceAnimation({ animate: true, live: true }),
      ).to.deep.equal({ animateLive: true });

      const force = layoutConfig.layoutOptions('force', {
        animate: true,
        live: true,
        seed: '5',
      });

      expect(force).to.deep.equal({
        name: 'force',
        animate: true,
        animateLive: true,
        seed: 5,
      });
      expect(
        layoutConfig.layoutOptions('radial', { animate: false }),
      ).to.deep.equal({
        name: 'radial',
        animate: false,
      });

      const spiral = layoutConfig.layoutOptions(
        'spiral',
        { animate: true },
        SpiralLayout,
      );

      expect(spiral.impl).to.equal(SpiralLayout);
      expect(spiral.animate).to.equal(true);
      expect(spiral.name).to.equal(undefined);
    });

    it('gates the hover panel by element count', function () {
      expect(
        layoutConfig.hoverAllowed(layoutConfig.HOVER_MAX_ELEMENTS),
      ).to.equal(true);
      expect(
        layoutConfig.hoverAllowed(layoutConfig.HOVER_MAX_ELEMENTS + 1),
      ).to.equal(false);
    });

    it('no load-time layout animates — the synchronous snapshot stands on it', function () {
      // the snapshot is taken right after cytoscape() returns, which is
      // only the laid-out graph because the factory's layout runs to
      // completion synchronously; an animated one would still be moving
      for (const [id, def] of Object.entries(networks)) {
        if (def.layout != null) {
          expect(
            def.layout.animate,
            `${id}'s load layout animates`,
          ).to.not.equal(true);
        }
      }
    });

    it('wires every control the layout, hover and init files reach for', function () {
      for (const file of ['layout.js', 'hover.js']) {
        const src = readFileSync(join(DEBUG, file), 'utf8');
        const ids = [...src.matchAll(/'#([\w-]+)'/g)].map((m) => m[1]);

        expect(ids.length, `${file} names no control`).to.be.at.least(2);

        for (const id of ids) {
          expect(
            html,
            `#${id} is wired in ${file} but not in index.html`,
          ).to.include(`id="${id}"`);
        }
      }

      // every URL param's control exists too
      const controls = [...initSrc.matchAll(/control: '#([\w-]+)'/g)].map(
        (m) => m[1],
      );

      expect(controls).to.include('layout-live-check');
      expect(controls).to.include('layout-edge-types-check');
      expect(controls).to.include('hover-select');

      for (const id of controls) {
        expect(
          html,
          `#${id} is a param control but not in index.html`,
        ).to.include(`id="${id}"`);
      }
    });

    describe('the spiral example, headless against the library', function () {
      const twoComponents = () => {
        const elements = [];

        for (const comp of ['a', 'b']) {
          for (let i = 0; i < 12; i++) {
            elements.push({ data: { id: comp + i } });

            if (i > 0) {
              elements.push({
                data: {
                  id: comp + 'e' + i,
                  source: comp + (i - 1),
                  target: comp + i,
                },
              });
            }
          }
        }

        return cytoscape({
          elements,
          style: { nodes: { width: 40, height: 40 } },
          headlessWidth: 800,
          headlessHeight: 600,
        });
      };

      const overlapping = (cy) => {
        const boxes = cy.nodes().map((n) => n.boundingBox());
        let count = 0;

        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i];
            const b = boxes[j];

            if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) {
              count++;
            }
          }
        }

        return count;
      };

      const run = (cy, opts) =>
        cy
          .layout({ impl: SpiralLayout, ...opts })
          .run()
          .promise();

      it('places without overlap, components apart, and fits', async function () {
        const cy = twoComponents();

        await run(cy, {});

        expect(overlapping(cy)).to.equal(0);

        const a = cy
          .nodes()
          .filter((n) => n.id().startsWith('a'))
          .boundingBox();
        const b = cy
          .nodes()
          .filter((n) => n.id().startsWith('b'))
          .boundingBox();
        const disjoint =
          a.x2 <= b.x1 || b.x2 <= a.x1 || a.y2 <= b.y1 || b.y2 <= a.y1;

        expect(disjoint, 'component boxes overlap').to.equal(true);
        expect(cy.zoom()).to.not.equal(1);
      });

      it('control: spiralStep 1 without avoidOverlap piles the nodes up', async function () {
        const cy = twoComponents();

        await run(cy, { spiralStep: 1, avoidOverlap: false, fit: false });
        expect(overlapping(cy)).to.be.greaterThan(0);
      });

      it('holds a locked node and animates to the same positions', async function () {
        const sync = twoComponents();

        await run(sync, { fit: false });

        const cy = twoComponents();

        cy.$id('a3').position({ x: 999, y: 999 }).lock();

        await run(cy, { fit: false, animate: true, animationDuration: 20 });

        expect(cy.$id('a3').position()).to.deep.equal({ x: 999, y: 999 });
        cy.nodes().forEach((n) => {
          if (n.id() === 'a3') {
            return;
          }

          // the locked node took no place on the spiral, so the ones after
          // it shift one step: compare against the sync run with the same
          // lock instead
          expect(Number.isFinite(n.position().x)).to.equal(true);
        });

        const syncLocked = twoComponents();

        syncLocked.$id('a3').position({ x: 999, y: 999 }).lock();
        await run(syncLocked, { fit: false });
        cy.nodes().forEach((n) => {
          const want = syncLocked.$id(n.id()).position();

          expect(n.position().x, n.id()).to.be.closeTo(want.x, 1e-3);
          expect(n.position().y, n.id()).to.be.closeTo(want.y, 1e-3);
        });
      });
    });
  });
});
