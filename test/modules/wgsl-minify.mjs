import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  minifyWgslTemplate,
  transformWgslTags,
} from '../../scripts/wgsl-minify.mjs';

/*
Round 52: the build-time WGSL comment-strip + whitespace collapse.

The transform sits between the source and every shipped bundle, which is
a new class of defect for this repo — the browser runs shader text no
human wrote.  Three layers of defence, in order of strength:

1. These specs pin the transform's contract: comments stripped,
   whitespace collapsed only where tokens cannot fuse, `${...}`
   interpolations byte-for-byte opaque, and the two authoring errors
   (an interpolation inside a WGSL comment; an unterminated block
   comment) thrown rather than mangled.  The plan's own named hazard —
   a transform that does NOT treat `${}` as opaque — runs as a control
   here: the fixture must come out mangled under it, or the fixture is
   not exercising what it claims to.
2. A token-stream audit over every tagged literal in the real sources:
   minification must preserve the WGSL token sequence exactly, checked
   with an independent tokenizer (regex-based, sharing no code with the
   transform, so one bug cannot hide on both sides).
3. The `visual` Playwright project diffs the rendered pixels of the
   built bundle against exact goldens — the only gate that proves the
   *browser* still compiles and draws the same image (52.2).
*/

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

// the seven modules that carry tagged WGSL (see src/render/wgsl.mts)
const WGSL_FILES = [
  'src/render/shaders.mts',
  'src/render/cull.mts',
  'src/render/gpu-force.mts',
  'src/render/gpu-tween.mts',
  'src/render/mapper-shaders.mts',
  'src/render/image-arrays.mts',
  'src/render/upscale.mts',
];

// An independent WGSL tokenizer for the audit: strips comments with
// regexes (the real sources use no nested block comments) and splits on
// a coarse token pattern.  Deliberately shares nothing with the
// transform's implementation.
const tokenize = (text) =>
  text
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\/\*[^]*?\*\//g, ' ')
    .match(/[A-Za-z_][A-Za-z0-9_]*|[0-9][0-9A-Za-z_.]*|\S/g) ?? [];

describe('wgsl-minify (round 52)', () => {
  describe('minifyWgslTemplate', () => {
    it('strips line comments, block comments and nested block comments', () => {
      const [out] = minifyWgslTemplate([
        'let a = 1u; // trailing note\n/* block */ let b = 2u;\n' +
          '/* outer /* inner */ still comment */ let c = 3u;',
      ]);

      expect(out).to.equal('let a=1u;let b=2u;let c=3u;');
    });

    it('collapses whitespace but never fuses tokens', () => {
      const [out] = minifyWgslTemplate([
        'fn  foo( a :  f32 ,\n  b : f32 ) ->  f32 {\n  return a - -b;\n}',
      ]);

      // word-word keeps one space; operator-operator keeps one space
      // ('- -' must not become '--'); punctuation adjacency drops them
      expect(out).to.equal('fn foo(a:f32,b:f32)->f32{return a- -b;}');
    });

    it('a comment separates tokens: stripping one leaves a space', () => {
      const [out] = minifyWgslTemplate(['let/* x */a = 1u;']);

      expect(out).to.equal('let a=1u;');
    });

    it('keeps a single leading/trailing space so concatenated parts cannot fuse', () => {
      const [out] = minifyWgslTemplate(['\n  fn f() {}\n']);

      expect(out).to.equal(' fn f(){} ');
    });

    // The plan's named fixture: interpolation sites next to punctuation,
    // where a naive whitespace pass rewrites the same characters.
    const FIXTURE = [
      '\nconst N: u32 = ',
      'u;\narr[',
      '];\nfn poly',
      'SD(p: vec2f) -> f32 { return length(p) - ',
      '; }\n// a plain comment line\nlet doc = ',
      ';\nlet url = ',
      ';\n',
    ];
    const FIXTURE_INTERPS = [
      'CURVE_SEGS',
      ' n - 1 ',
      'id',
      'fmtF32(r)',
      "'docs'",
      "'a//b'",
    ];
    const joinParts = (texts, interps) =>
      texts.reduce((acc, t, i) => acc + '${' + interps[i - 1] + '}' + t);

    it('treats ${} as opaque: interpolation code is byte-identical', () => {
      // reconstruct a module snippet and run the real transform
      const mod =
        'const S = wgsl`' + joinParts(FIXTURE, FIXTURE_INTERPS) + '`;';
      const out = transformWgslTags(mod, 'fixture.mts');

      for (const interp of FIXTURE_INTERPS) {
        expect(
          out,
          `interpolation \${${interp}} must survive untouched`,
        ).to.include('${' + interp + '}');
      }

      // glued identifiers stay glued: no space invented around ${id}
      expect(out).to.include('fn poly${id}SD(p:vec2f)->f32');
      // whitespace that existed next to an interpolation collapses to
      // one space rather than vanishing (the value's edge is unknowable),
      // while the interpolation's other side, glued in source, stays glued
      expect(out).to.include('u32= ${CURVE_SEGS}u;');
    });

    it('CONTROL: a transform that does not treat ${} as opaque mangles the fixture', () => {
      // feed the fully joined template text through the minifier as one
      // static chunk — exactly what a non-opaque transform would do
      const joined = joinParts(FIXTURE, FIXTURE_INTERPS);
      const [naive] = minifyWgslTemplate([joined]);

      // the spaced interpolation is rewritten...
      expect(naive).to.not.include('${ n - 1 }');
      // ...and the '//' inside a string interpolation is read as a
      // comment opener, deleting part of the program
      expect(naive).to.not.include("'a//b'");
    });

    it('throws when an interpolation falls inside a line comment', () => {
      expect(() =>
        minifyWgslTemplate(['let a = 1u; // gap is ', ' px\nlet b = 2u;']),
      ).to.throw(/interpolation inside a WGSL comment/);
    });

    it('throws when an interpolation falls inside a block comment', () => {
      expect(() =>
        minifyWgslTemplate(['let a = 1u; /* gap is ', ' px */']),
      ).to.throw(/unterminated WGSL block comment/);
    });
  });

  describe('transformWgslTags', () => {
    it('leaves untagged template literals untouched', () => {
      const mod = 'const err = `bad value // see https://js.cytoscape.org`;';

      expect(transformWgslTags(mod, 't.mts')).to.equal(mod);
    });

    it('drops the tag: the emitted literal is untagged and minified', () => {
      const out = transformWgslTags(
        'const S = wgsl`\n// comment\nfn f() {}\n`;',
        't.mts',
      );

      expect(out).to.equal('const S = ` fn f(){} `;');
    });

    it('member access .wgsl` is not a tag', () => {
      const mod = 'const s = obj.wgsl`// kept`;';

      expect(transformWgslTags(mod, 't.mts')).to.equal(mod);
    });

    it('a tag inside a string or comment is not a tag', () => {
      const mod =
        "const doc = 'use wgsl` to mark';\n// wgsl` in a comment\nlet x = 1;";

      expect(transformWgslTags(mod, 't.mts')).to.equal(mod);
    });

    it('finds a nested tagged literal inside an interpolation', () => {
      const out = transformWgslTags(
        'const S = wgsl`fn a() {}\n${flag ? wgsl`// note\nlet b = 1u;` : ""}\n`;',
        't.mts',
      );

      expect(out).to.include('${flag ? ` let b=1u;` : ""}');
      expect(out).to.not.include('wgsl`');
      expect(out).to.not.include('// note');
    });

    it('is the identity on a module with no tag', () => {
      const mod = 'export const x = 1;\n';

      expect(transformWgslTags(mod, 't.mts')).to.equal(mod);
    });
  });

  describe('the real sources', () => {
    it('every tagged literal minifies to the identical WGSL token stream', () => {
      let literals = 0;

      for (const file of WGSL_FILES) {
        const src = readFileSync(join(root, file), 'utf8');

        transformWgslTags(src, file, (texts, minified, where) => {
          literals++;

          for (let i = 0; i < texts.length; i++) {
            expect(
              tokenize(minified[i]),
              `${where} chunk ${i} must keep its token stream`,
            ).to.deep.equal(tokenize(texts[i]));
          }
        });
      }

      // the audit is only as good as its enumeration: the tag count is
      // pinned so a scanner that silently stops matching fails here
      // rather than reading as "all clean" over nothing
      expect(literals).to.be.at.least(45);
    });

    it('minification pays: at least a third of the tagged text is removed', () => {
      let before = 0;
      let after = 0;

      for (const file of WGSL_FILES) {
        const src = readFileSync(join(root, file), 'utf8');

        transformWgslTags(src, file, (texts, minified) => {
          before += texts.reduce((n, t) => n + t.length, 0);
          after += minified.reduce((n, t) => n + t.length, 0);
        });
      }

      expect(before).to.be.greaterThan(100_000); // the shaders are big
      expect(after).to.be.lessThan(before * (2 / 3));
    });
  });

  describe('the built bundles (52.2, the shipped half)', () => {
    // test:modules runs `build` first, so these read fresh bundles
    it('the bundles carry the shaders with their comments stripped', () => {
      for (const bundle of [
        'build/cytoscape.min.js',
        'build/cytoscape.cjs.js',
      ]) {
        const code = readFileSync(join(root, bundle), 'utf8');

        // a comment that lives inside a tagged literal in source...
        expect(
          readFileSync(join(root, 'src/render/shaders.mts'), 'utf8'),
        ).to.include('Knuth hash decorrelates');
        // ...must be gone from what ships, while the shader is present
        expect(code, `${bundle} must not carry WGSL comments`).to.not.include(
          'Knuth hash decorrelates',
        );
        expect(code, `${bundle} must still carry the shader`).to.include(
          'fn edgeLod',
        );
        // and the tag itself is dropped, not shipped
        expect(code, `${bundle} must not carry the wgsl tag`).to.not.include(
          'wgsl`',
        );
      }
    });
  });
});
