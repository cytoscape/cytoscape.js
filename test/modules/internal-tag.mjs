import {
  auditFile,
  auditParamTags,
  auditReturnTags,
  auditThrowTags,
  PUBLIC_API,
} from '../../scripts/jsdoc-coverage.mjs';
import { stripInternal } from '../../scripts/build-dts.mjs';
import { generate } from '../../scripts/docs-generate.mjs';
import { expect } from 'chai';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
Round 90.0: the `@internal` privacy marker, member-grained.

`PUBLIC_API` is a file list, so before this round the public/internal
tier boundary was file-grained where the truth is member-grained — the
renderer calls StyleEngine's machinery cross-module, so TS `private`
cannot mark it.  A member whose doc block carries `@internal` is
demoted: the scanner moves it to the internal tier, the three tag
gates stop applying to it, the docs generator omits it, and the d.ts
build strips it from `dist/cytoscape.d.ts`.

Every consumer of the tag gets a fixture spec *and a control* — the
same member without the tag must be seen/kept — because a marker one
consumer silently ignores is a member that reads demoted and ships
public anyway.  Fixtures are written in the exact shape the scanner
parses (doc block directly above the member, two-space class
indentation): a fixture the tool silently skips is a spec that can
never fail (round 36's audit-fixture lesson).
*/

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

// One member of each audited kind, in tagged and untagged variants. The
// untagged variant is the control: it deliberately carries none of the
// three gate tags, so every audit must flag it — proving the audit still
// looks at members shaped exactly like the demoted one.
const fixture = (tag) => `/**
 * A member that takes an argument, returns a value and throws${
   tag ? ', demoted.\n *\n * @internal' : '.'
 }
 */
export function fn(a: number): number {
  if (!a) throw new Error('bad');

  return a;
}

export class Fixture {
  /**
   * Same shape as a class member${tag ? '.\n   *\n   * @internal' : '.'}
   */
  member(a: number): number {
    if (!a) throw new Error('bad');

    return a;
  }
}
`;

describe('gpu/modules: the @internal tag (round 90.0)', function () {
  let dir;
  let tagged;
  let untagged;

  before(function () {
    dir = mkdtempSync(join(tmpdir(), 'internal-tag-'));
    tagged = join(dir, 'tagged.mts');
    untagged = join(dir, 'untagged.mts');
    writeFileSync(tagged, fixture(true));
    writeFileSync(untagged, fixture(false));
  });

  after(function () {
    rmSync(dir, { recursive: true, force: true });
  });

  describe('the scanner', function () {
    it('marks tagged members internal', function () {
      const { members } = auditFile(tagged);
      const names = members.map((m) => [m.owner, m.name, m.internal]);

      expect(names).to.deep.equal([
        [null, 'fn', true],
        ['Fixture', 'member', true],
      ]);
    });

    it('control: untagged members read public', function () {
      const { members } = auditFile(untagged);

      expect(members.map((m) => m.internal)).to.deep.equal([false, false]);
    });

    it('a tagged member still requires its doc comment', function () {
      // internal means hidden from consumers, not undocumented: both
      // fixtures are fully documented and neither reports a miss
      expect(auditFile(tagged).missing).to.deep.equal([]);
    });
  });

  describe('the tag gates stop at the tier boundary', function () {
    it('@param, @returns and @throws skip tagged members', function () {
      // the tagged fixture carries none of the three tags, so a hit in
      // any missing list means the audit still treats it as public
      expect(auditParamTags(tagged).missing).to.deep.equal([]);
      expect(auditReturnTags(tagged).missing).to.deep.equal([]);
      expect(auditThrowTags(tagged).missing).to.deep.equal([]);
    });

    it('control: the same members untagged are flagged by all three', function () {
      expect(auditParamTags(untagged).missing).to.have.length(2);
      expect(auditReturnTags(untagged).missing).to.have.length(2);
      expect(auditThrowTags(untagged).missing).to.have.length(2);
    });
  });

  describe('the d.ts strip', function () {
    const dts = `declare class Kept {
  /** stays */
  kept(a: number): number;
  /**
   * goes
   * @internal
   */
  gone(a: number): number;
  /**
   * goes, wrapped signature
   * @internal
   */
  goneWrapped(
    a: number,
    b: (x: string) => void,
  ): number;
  /** stays too */
  keptToo(): void;
}
/**
 * whole class goes
 * @internal
 */
declare class Gone {
  member(): void;
}
declare function keptFn(): void;
`;

    it('removes tagged members, wrapped signatures and whole classes', function () {
      const out = stripInternal(dts);

      expect(out).to.not.match(/\bgone\b|\bgoneWrapped\b|class Gone|@internal/);
      // the neighbours survive intact — a strip that eats the next
      // declaration is worse than no strip
      expect(out).to.match(/kept\( a: number \)|kept\(a: number\)/);
      expect(out).to.include('keptToo(): void;');
      expect(out).to.include('declare function keptFn(): void;');
    });

    it('control: without tags the text passes through byte-identical', function () {
      const clean = dts.replace(/^.*@internal.*\n/gm, '');

      expect(stripInternal(clean)).to.equal(clean);
    });

    it('is idempotent', function () {
      const once = stripInternal(dts);

      expect(stripInternal(once)).to.equal(once);
    });
  });

  describe('the demotion holds on the real tree', function () {
    it('no scanner-internal member appears in the generated docs model', function () {
      const internal = new Set();

      for (const rel of PUBLIC_API) {
        for (const m of auditFile(join(ROOT, rel)).members) {
          if (m.internal) internal.add(m.name);
        }
      }

      const published = new Set();

      for (const section of generate().sections) {
        for (const child of section.sections) {
          for (const fn of child.fns) {
            published.add(fn.name.split('.').pop());
          }
        }
      }

      // the walk itself is guarded: an empty model means the shape drifted
      // and this spec went blind, which must read as red, not pass
      expect(published.size).to.be.at.least(100);

      const leaked = [...internal].filter((name) => published.has(name));

      expect(leaked, 'internal members in the docs model').to.deep.equal([]);
    });

    it('the shipped declaration carries no @internal member', function () {
      const shipped = join(ROOT, 'dist/cytoscape.d.ts');

      expect(existsSync(shipped)).to.equal(true);
      expect(readFileSync(shipped, 'utf8')).to.not.include('@internal');
    });
  });
});
