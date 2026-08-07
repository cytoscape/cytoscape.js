import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  generate,
  NAMESPACES,
  NOT_PUBLISHED,
} from '../scripts/docs-generate.mjs';
import {
  auditStrandedComments,
  PUBLIC_API,
} from '../scripts/jsdoc-coverage.mjs';

/*
Round 45's gate: the generated documentation model, checked against the
**shipped declaration** rather than against the sources it was generated from.

That is the whole point of the choice. Generator and audit read the same
files with the same scanner, so checking one against the other proves only
that a regex is self-consistent. `dist/cytoscape.d.ts` is a different
artifact, produced by a different tool (rolldown-dts) from the same source,
and it is the thing a consumer actually holds — so it is the only available
independent witness to what the public surface *is*.

Two failure directions, and both matter:

  - a **phantom** entry: the reference documents a member that does not ship,
    which sends a reader to a method that is not there;
  - a **dropped** entry: a member ships undocumented, which is the failure
    round 26's coverage gate exists to prevent and would be reintroduced
    silently if the generator quietly skipped a class.

It also pins the precondition round 45's plan asks for: no stranded doc block
in a published file. Round 36 left that check reporting-only because it cannot
tell a deliberately free-standing module note from a displaced block — a fair
limit for `src` at large, where the one standing hit is exactly such a note.
Inside the *published* files it is not ambiguous: a displaced block there is a
member's prose attached to its neighbour, and the generator would now ship it
twice, under the wrong name both times.
*/

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DTS = readFileSync(join(ROOT, 'dist/cytoscape.d.ts'), 'utf8');

/**
 * The public member names of a class in the shipped declaration.
 *
 * Private/protected members and `_`-prefixed ones are excluded, matching what
 * the coverage audit counts as public; nested object-type members sit at four
 * spaces and so never match; doc-comment bodies start with `*`.
 */
function dtsMembers(className) {
  const start = DTS.indexOf(`declare class ${className} {`);

  expect(
    start,
    `no declare class ${className} in the shipped d.ts`,
  ).to.be.greaterThan(-1);

  const rest = DTS.slice(start).split('\n');
  const members = new Set();

  for (let i = 1; i < rest.length; i++) {
    const line = rest[i];

    if (line === '}') break;

    const m = line.match(
      /^ {2}(?:(private|protected)\s+)?(?:static\s+)?(?:readonly\s+)?(?:(get|set)\s+)?(?:abstract\s+)?([A-Za-z_$][\w$]*)\??\s*(?:<[^>=]*>)?\s*[(:]/,
    );

    if (!m) continue;
    if (m[1]) continue;
    if (m[3].startsWith('_')) continue;

    members.add(m[3]);
  }

  return members;
}

/** Names the `declare namespace cytoscape { export { … } }` block re-exports. */
function dtsFactoryStatics() {
  const block = DTS.match(/declare namespace cytoscape \{([\s\S]*?)\n\}/);

  expect(
    block,
    'no cytoscape namespace block in the shipped d.ts',
  ).to.not.equal(null);

  return new Set(
    [...block[1].matchAll(/export \{\s*([A-Za-z_$][\w$]*)\s*\}/g)].map(
      (m) => m[1],
    ),
  );
}

const model = generate();
const allFns = model.sections.flatMap((s) => s.sections.flatMap((c) => c.fns));

/** Every fn the model publishes under one prefix, by bare member name. */
function membersUnder(prefix) {
  const section = model.sections.find((s) => s.prefix === prefix);

  expect(section, `the model publishes no ${prefix} namespace`).to.not.equal(
    undefined,
  );

  const names = new Set();

  for (const child of section.sections) {
    for (const fn of child.fns) {
      // `cy.add` -> `add`; the bare factory entry is just `cytoscape`
      const bare = fn.name.includes('.')
        ? fn.name.slice(fn.name.indexOf('.') + 1)
        : null;

      if (bare != null) names.add(bare);

      for (const alias of fn.pureAliases ?? []) {
        names.add(alias.slice(alias.indexOf('.') + 1));
      }
    }
  }

  return names;
}

describe('the docs generator', () => {
  describe('the model it builds', () => {
    it('covers every published namespace at a non-trivial size', () => {
      // The guard every other spec here needs: a generator that produced
      // nothing would satisfy "no phantom entries" perfectly.
      expect(model.sections.length).to.equal(
        Object.keys(NAMESPACES).length + 1,
      ); // + the factory
      expect(allFns.length).to.be.greaterThan(300);

      const sections = model.sections.reduce(
        (n, s) => n + s.sections.length,
        0,
      );

      expect(sections).to.be.greaterThan(30);
    });

    it('documents each member exactly once', () => {
      const seen = new Map();

      for (const fn of allFns) {
        expect(
          seen.has(fn.name),
          `${fn.name} documented twice (${seen.get(fn.name)} and ${fn.src})`,
        ).to.equal(false);
        seen.set(fn.name, fn.src);
      }
    });

    it('gives every entry a description and every argument a description', () => {
      for (const fn of allFns) {
        expect(fn.descr, `${fn.name} has no description`)
          .to.be.a('string')
          .and.not.equal('');

        expect(
          fn.formats.length,
          `${fn.name} has no formats`,
        ).to.be.greaterThan(0);

        for (const format of fn.formats) {
          for (const arg of format.args) {
            expect(arg.name, `${fn.name} has an unnamed argument`)
              .to.be.a('string')
              .and.not.equal('');
            expect(arg.descr, `${fn.name}( ${arg.name} ) has no description`)
              .to.be.a('string')
              .and.not.equal('');
          }
        }
      }
    });

    it('gives an overloaded member one format per signature', () => {
      // `cy.on` is the canonical case: two overloads, one of which is the
      // predicate-delegation form, and a reader needs both argument lists.
      const on = allFns.find((f) => f.name === 'cy.on');

      expect(on, 'cy.on missing from the model').to.not.equal(undefined);
      expect(on.formats.length).to.equal(2);
      expect(on.formats[1].args.map((a) => a.name)).to.deep.equal([
        'events',
        'predicate',
        'callback',
      ]);
      // and its aliases ride with it rather than becoming their own entries
      expect(on.pureAliases).to.include('cy.addListener');
      expect(allFns.some((f) => f.name === 'cy.addListener')).to.equal(false);
    });
  });

  describe('against the shipped declaration', () => {
    it('documents no member that does not ship (no phantom entries)', () => {
      for (const [className, prefix] of Object.entries(NAMESPACES)) {
        const shipped = dtsMembers(className);

        for (const name of membersUnder(prefix)) {
          expect(
            shipped.has(name),
            `${prefix}.${name} is documented but not in ${className}'s declaration`,
          ).to.equal(true);
        }
      }
    });

    it('documents every member that ships (nothing silently dropped)', () => {
      for (const [className, prefix] of Object.entries(NAMESPACES)) {
        const documented = membersUnder(prefix);

        for (const name of dtsMembers(className)) {
          // `constructor` is in the declaration but is not a documented
          // member of the reference; a consumer never calls it directly.
          if (name === 'constructor') continue;

          expect(
            documented.has(name),
            `${className}.${name} ships but the reference does not document it`,
          ).to.equal(true);
        }
      }
    });

    it('documents the factory and exactly the statics it hangs on itself', () => {
      const factory = model.sections.find((s) => s.prefix === 'cytoscape');
      const names = factory.sections.flatMap((c) => c.fns.map((f) => f.name));

      expect(names).to.include('cytoscape');
      expect(DTS).to.match(/declare function cytoscape\(/);

      const statics = dtsFactoryStatics();
      const documented = new Set(
        names
          .filter((n) => n !== 'cytoscape')
          .map((n) => n.slice('cytoscape.'.length)),
      );

      expect([...documented].sort()).to.deep.equal([...statics].sort());
    });

    it('leaves the unpublished classes unpublished, each with a reason', () => {
      const published = new Set(Object.keys(NAMESPACES));

      for (const [className, reason] of Object.entries(NOT_PUBLISHED)) {
        expect(
          published.has(className),
          `${className} is in both tables`,
        ).to.equal(false);
        expect(reason, `${className} is excluded without a reason`).to.be.a(
          'string',
        );
        expect(
          reason.length,
          `${className}'s reason is too short to be one`,
        ).to.be.greaterThan(30);
      }
    });
  });

  describe('preconditions', () => {
    it('has no stranded doc block in a published file', () => {
      const stranded = PUBLIC_API.flatMap(
        (rel) => auditStrandedComments(join(ROOT, rel)).stranded,
      );

      expect(
        stranded,
        `a displaced block would be published twice: ${stranded.join(', ')}`,
      ).to.have.lengthOf(0);
    });
  });
});
