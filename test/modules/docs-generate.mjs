import { expect } from 'chai';

import {
  parseDoc,
  sectionTitle,
  factoryStatics,
} from '../../scripts/docs-generate.mjs';

/*
Round 45: the docs generator's parser, against fixtures.

The precedent is `test/modules/throw-coverage.mjs` and its siblings — a
tool's parser gets a fixture rather than trust, because a scanner that
silently stops matching reads exactly like a clean tree.

The fixtures below are written in the shape the sources actually use:
two-space class-body indentation, ` * ` continuation, an em dash between a
`@param`'s name and its description. That is not cosmetic. Round 36.1 wrote
two fixtures as one-liners with the comment inline (`/** a *\/ a(): void {}`),
a shape the scanner does not match and the real sources never use, and two
specs passed with the behaviour under test deliberately broken.
*/

const block = (lines) =>
  ['  /**', ...lines.map((l) => `   *${l ? ` ${l}` : ''}`), '   */'].join('\n');

describe('docs generator: parseDoc', () => {
  it('takes the prose before the first tag as the description', () => {
    const doc = parseDoc(
      block([
        'Add elements to the graph.',
        '',
        'A second paragraph, which is where the deviations live.',
        '',
        '@param input — the elements',
        '@returns the added collection',
      ]),
    );

    expect(doc.descr).to.equal(
      'Add elements to the graph.\n\nA second paragraph, which is where the deviations live.',
    );
  });

  it('unwraps a paragraph that the source wrapped over several lines', () => {
    // Doc comments are hard-wrapped to fit the column limit; a reader of the
    // generated reference must not see those line breaks.
    const doc = parseDoc(
      block([
        'One sentence that the author wrapped',
        'across three source lines because of',
        'the column limit.',
      ]),
    );

    expect(doc.descr).to.equal(
      'One sentence that the author wrapped across three source lines because of the column limit.',
    );
  });

  it('splits a @param on the em dash, not on the first space', () => {
    // The separator matters: an argument description routinely contains
    // dashes, colons and parentheses of its own.
    const doc = parseDoc(
      block([
        'Summary.',
        '',
        '@param events — one or more space-separated names — comma-free',
      ]),
    );

    expect(doc.params).to.deep.equal([
      {
        name: 'events',
        descr: 'one or more space-separated names — comma-free',
      },
    ]);
  });

  it('joins a @param description continued on the following lines', () => {
    const doc = parseDoc(
      block([
        'Summary.',
        '',
        '@param predicateOrCb — the delegation predicate when `callback` is',
        '  given, otherwise the handler itself',
        '@param callback — the handler, when delegating',
      ]),
    );

    expect(doc.params).to.deep.equal([
      {
        name: 'predicateOrCb',
        descr:
          'the delegation predicate when `callback` is given, otherwise the handler itself',
      },
      { name: 'callback', descr: 'the handler, when delegating' },
    ]);
  });

  it('keeps @returns, @throws and @see as their own fields', () => {
    // docmaker has no field for any of the three. Folding them into the
    // description would be lossy in a way a template cannot undo, so they
    // are emitted structurally and a template ignores what it does not know.
    const doc = parseDoc(
      block([
        'Summary.',
        '',
        '@returns this core, for chaining',
        '@throws if the sheet references an unknown property',
        '@throws if a mapper appears in a constants-only prop',
        '@see Core#off — removing takes the same triple',
      ]),
    );

    expect(doc.returns).to.equal('this core, for chaining');
    expect(doc.throws).to.deep.equal([
      'if the sheet references an unknown property',
      'if a mapper appears in a constants-only prop',
    ]);
    expect(doc.see).to.deep.equal([
      'Core#off — removing takes the same triple',
    ]);
  });

  it('answers empty for a member with no doc block at all', () => {
    // Not reachable through the gated surface — coverage is 100% — but the
    // generator must not throw on an internal member if the tier ever widens.
    const doc = parseDoc('');

    expect(doc.descr).to.equal('');
    expect(doc.params).to.deep.equal([]);
    expect(doc.returns).to.equal(null);
  });

  it('reads a one-line block, the shape most fields use', () => {
    const doc = parseDoc('  /** How many elements this collection holds. */');

    expect(doc.descr).to.equal('How many elements this collection holds.');
  });
});

describe('docs generator: sectionTitle', () => {
  it('capitalizes a banner', () => {
    expect(sectionTitle('graph manipulation')).to.equal('Graph manipulation');
  });

  it('drops a trailing round reference', () => {
    // `// -- controls (round 24.3) --` is a code-navigation aid; a reader of
    // the API reference has no use for it in a heading.
    expect(sectionTitle('controls (round 24.3)')).to.equal('Controls');
    expect(sectionTitle('compound hierarchy (round 14.2)')).to.equal(
      'Compound hierarchy',
    );
  });

  it('leaves any other parenthetical alone', () => {
    // It is the author's, and it is usually the useful half of the title.
    expect(sectionTitle('style (read-only)')).to.equal('Style (read-only)');
    expect(sectionTitle('animation (viewport)')).to.equal(
      'Animation (viewport)',
    );
  });
});

describe('docs generator: factoryStatics', () => {
  it('reads the statics off the entry point rather than a hand list', () => {
    // This is what decides whether an exported function is published: wire.mts
    // and columnar.mts export type predicates beside the three the factory
    // hangs on itself, and only the latter are reachable by a consumer.
    const statics = factoryStatics();

    expect([...statics].sort()).to.deep.equal([
      'deserializeElements',
      'serializeElements',
      'toColumnarElements',
    ]);
    // the worker bootstrap's __runRenderWorker__ hangs off the factory
    // too (round 86.3); underscore hooks are machinery and never publish
    expect(statics.has('__runRenderWorker__')).to.equal(false);
  });
});
