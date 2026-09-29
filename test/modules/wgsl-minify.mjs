import { expect } from 'chai';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
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

Round 126 found layer 2 auditing 15 of the 32 tagged files — the list
was written by hand in round 52 and every GPU algorithm kernel since had
landed outside it, reading as clean.  The list is now the tree's own
(every `.mts` naming the tag), with its size pinned.  The round also
shortened float literals (`1.0` -> `1.`), so the audit compares a float
token by its value rather than its spelling, and added the `glsl` tag
for the WebGL2 renderer (round 137), whose lexical rules differ in the
two places pinned below: block comments do not nest, and a directive
keeps its line.
*/

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

/** Every `.mts` under src/ that names a shader tag, from the root. */
const taggedFiles = (dir = join(root, 'src'), out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);

    if (statSync(p).isDirectory()) {
      taggedFiles(p, out);
    } else if (
      name.endsWith('.mts') &&
      /\b(wgsl|glsl)`/.test(readFileSync(p, 'utf8'))
    ) {
      out.push(relative(root, p));
    }
  }

  return out;
};

// the modules that carry tagged WGSL (see src/gpu/wgsl.mts), found by
// scanning — 32 at round 126, when the hand-kept list held 15
const WGSL_FILES = taggedFiles();

// An independent WGSL tokenizer for the audit: strips comments with
// regexes (the real sources use no nested block comments) and splits on
// a coarse token pattern.  A decimal float token compares by its value
// (`1.0` and `1.` are one literal).  Deliberately shares nothing with
// the transform's implementation.
const tokenize = (text) =>
  (
    text
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/\/\*[^]*?\*\//g, ' ')
      .match(/[A-Za-z_][A-Za-z0-9_]*|\.?[0-9][0-9A-Za-z_.]*|\S/g) ?? []
  ).map((tok) => {
    const m = /^(\d*\.\d*)([eE]?[fh]?)$/.exec(tok);

    return m ? `float:${Number(m[1])}${m[2]}` : tok;
  });

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

    it('shortens float literals without changing their value (126)', () => {
      const [out] = minifyWgslTemplate([
        'let a = vec4f(1.0, 0.50, 10.0, 0.0); let b = 2.0e3 + 1.0f + .250;',
      ]);

      expect(out).to.equal('let a=vec4f(1.,.5,10.,0.);let b=2.e3+1.f+.25;');
    });

    it('leaves integers, hex, identifiers and suffixes other than f/h alone', () => {
      const [out] = minifyWgslTemplate([
        'let a = 10u + 100 + 0x1F + 0i; let v = vec4f(); let w = v.x0;',
      ]);

      expect(out).to.equal('let a=10u+100+0x1F+0i;let v=vec4f();let w=v.x0;');
    });

    it('never shortens a float that touches an interpolation', () => {
      // `${n}.50` and `2.50${k}` continue a number the build cannot see
      const out = minifyWgslTemplate(['let a = ', '.50 + 2.50', ';']);

      expect(out).to.deep.equal(['let a= ', '.50+2.50', ';']);
    });
  });

  describe('minifyWgslTemplate, GLSL ES 3.00 (126, for round 137)', () => {
    const SRC =
      '\n  #version 300 es\n' +
      'precision highp float; // default\n' +
      '#define SCALE(x) ((x) * 2.0)\n' +
      '#define ONE (1.0)\n' +
      '/* a /* not nested */ out vec4 color;\n' +
      'void main() {\n  color = vec4(SCALE(ONE));\n}\n';

    it('keeps each directive on its own line, spacing inside it kept', () => {
      const [out] = minifyWgslTemplate([SRC], 'fixture', 'glsl');

      expect(out).to.equal(
        '\n#version 300 es\n' +
          'precision highp float;\n' +
          '#define SCALE(x) ((x) * 2.)\n' +
          '#define ONE (1.)\n' +
          'out vec4 color;void main(){color=vec4(SCALE(ONE));} ',
      );
    });

    it('CONTROL: under WGSL rules the same text is not valid GLSL', () => {
      // WGSL's nested comments swallow the declaration after `/* a /*`,
      // and its collapse joins the directives into one line
      expect(() => minifyWgslTemplate([SRC], 'fixture', 'wgsl')).to.throw(
        /unterminated WGSL block comment/,
      );
      const [flat] = minifyWgslTemplate(
        [SRC.replace('/* a /* not nested */', '')],
        'fixture',
        'wgsl',
      );

      expect(flat).to.not.include('\n');
    });

    it('an interpolation inside a directive keeps the directive open', () => {
      const out = minifyWgslTemplate(
        ['#define N ', '\nfloat a[N];'],
        'fixture',
        'glsl',
      );

      expect(out).to.deep.equal(['#define N ', '\nfloat a[N];']);
    });

    it('throws on an interpolation inside a GLSL comment', () => {
      expect(() =>
        minifyWgslTemplate(['float a; // see ', '\n'], 'fixture', 'glsl'),
      ).to.throw(/interpolation inside a WGSL comment/);
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

    it('minifies a glsl-tagged literal under GLSL rules and drops the tag', () => {
      const out = transformWgslTags(
        'const S = glsl`#version 300 es\nprecision highp float;\n`;',
        't.mts',
      );

      expect(out).to.equal(
        'const S = `#version 300 es\nprecision highp float; `;',
      );
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

      // the audit is only as good as its enumeration: the file and tag
      // counts are pinned so a scanner that silently stops matching fails
      // here rather than reading as "all clean" over nothing
      expect(WGSL_FILES).to.have.length.of.at.least(32);
      expect(WGSL_FILES).to.include('src/algorithms/algo-gpu-cluster.mts');
      expect(literals).to.be.at.least(110);
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
          readFileSync(join(root, 'src/render/shaders/common.mts'), 'utf8'),
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
