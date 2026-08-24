// Measures JSDoc coverage of the v4 GPU prototype (src), the authoring
// surface the release documentation is generated from (round 26; see PLAN.md
// and the "Documenting the source" section of src/README.md).
//
// A *public member* is a member of an exported class whose name does not begin
// with `_` and which is not marked `private`/`protected`, plus every top-level
// exported function — i.e. exactly what a consumer can reach and what a docs
// generator would emit. Coverage is split
// into two tiers: the PUBLIC_API files, which are the documented v4 surface and
// are gated at 100%, and everything else in src, which is documented for
// the next maintainer and carries a ratcheting floor.
//
// Run directly (`node scripts/jsdoc-coverage.mjs [--verbose]`) for a report;
// `test/jsdoc-coverage.mjs` imports `audit()` and enforces the thresholds.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_DIR = join(ROOT, 'src');

/**
 * The v4 public API: the files whose exported classes a consumer of
 * `cytoscape/gpu` actually holds. Gated at 100% public-member coverage.
 */
export const PUBLIC_API = [
  'src/index.mts',
  'src/core.mts',
  'src/collection.mts',
  'src/viewport.mts',
  'src/animation.mts',
  'src/style.mts',
  'src/columnar.mts',
  'src/wire.mts',
  'src/layout/contract.mts',
  // Round 45: `Event` ships as a named type export and is handed to every
  // handler a consumer writes, so it is public by this file's own definition
  // ("the files whose exported classes a consumer actually holds") and had
  // been sitting in the internal tier since round 41 created it. Found by
  // the docs generator, which could not place a namespace the tier did not
  // enumerate. Fourth instance of the same failure — round 32 walked class
  // bodies only, round 36 missed exported functions, round 37.3 missed
  // `export default function`, and this one missed a file. An audit's scope
  // is part of its claim.
  //
  // `src/emitter.mts` is deliberately *not* here: `EventHandler` is exported
  // from it as a type, but `Emitter` itself is not a named export and a
  // consumer never holds one.
  'src/event.mts',
];

// Round 90: the member-grained privacy marker.  A member whose doc block
// carries `@internal` is *demoted*: it stays documented (internal means
// hidden from consumers, not undocumented), but it moves from the public
// tier to the internal tier, the `@param`/`@returns`/`@throws` gates stop
// applying to it (those exist for shipped hover text, and an internal
// member ships none), the docs generator omits it, and the d.ts build
// strips it from `dist/cytoscape.d.ts` (`scripts/build-dts.mjs`).
// `PUBLIC_API` is a *file* list, so before this tag the tier boundary was
// file-grained where the truth is member-grained — the renderer calls
// these members cross-module, so TS `private` cannot mark them.
export const INTERNAL_RE = /@internal\b/;

// A member declaration at class-body indentation: an optional modifier run,
// then the name, then `(`, `:` or `=`. Deliberately anchored at two spaces so
// nested function bodies inside a method never match.
//
// The `\??` matters more than it looks: without it an *optional* field
// (`target?: EventTarget`) does not match, so every optional member of an
// exported class was invisible to every audit. Round 45 found six of them on
// `Event` alone — the object handed to every handler a consumer writes.
const MEMBER_RE =
  /^ {2}(?:(public|private|protected)\s+)?(?:static\s+)?(?:readonly\s+)?(?:(get|set)\s+)?(?:async\s+)?(?:\*\s*)?([A-Za-z_$][\w$]*)\??\s*(?:<[^>=]*>)?\s*(?:\(|[:=])/;
const CLASS_RE = /^(export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/;

// The @param audit reads its argument list from the *joined* signature
// (`signatureOf` + `argListOf`) rather than from the declaration line, so
// CALL_MEMBER_RE below is all the line itself has to match.
//
// Round 57.2 is why. The audit used to capture the arguments inline with
// `\(([^)]*)\)`, which needs the whole list on one line — and a member
// whose parameters wrapped therefore matched nothing and was **skipped**,
// silently, by an audit that gates at 100%. `Collection.boundingBoxAt`
// wrapped and had no `@param` at all; adopting a formatter joined its
// signature and the gate failed on the spot. That is the sixth time an
// audit's *scope* has turned out to be part of its claim (rounds 32, 36,
// 37.3, 45 twice), and the first time a tool other than a widening found
// it. `exportedFns` had joined since round 36 and said so in its comment,
// fifteen lines below the branch that did not.

// Any other top-level declaration ends the class body we are inside. Without
// this an `interface`'s members read as members of the class above it.
const TOP_LEVEL_RE =
  /^(?:export\s+)?(?:declare\s+)?(?:default\s+)?(?:interface|type|function|const|let|var|enum|namespace|module)\b/;

// A top-level exported function, in any of its spellings: `export function f(`,
// `export default function f(`, and `export const f = (` / `= async (` /
// `= function`. Exported consts that are not functions are data, not API
// surface, and are left out.
//
// `default` was missing until round 37.3, and it cost the audit the single
// most public member in the tree: `src/index.mts` is listed in PUBLIC_API,
// and its whole surface is `export default function cytoscapeGpu` — the
// package entry point — so the file contributed **zero** members to coverage,
// @param, @returns and @throws alike, while reading as audited and complete.
// This is round 36's widening (class bodies only → plus exported functions)
// finding its third case, and the standing lesson with it: an audit's scope is
// part of its claim, so check what it enumerates before quoting its 100%.
//
// The const branch is matched against the declaration line *joined with the
// next one* (`declHead`), because a formatter breaks after the `=` when the
// arrow head does not fit: `export const pointsEasing =\n  (points: …) =>`.
// Round 57.2 adopted one and `pointsEasing` vanished from every audit — the
// same failure as the four before it, arriving from the tool side rather
// than from a widening.
const EXPORTED_FN_RE =
  /^export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^export\s+const\s+([A-Za-z_$][\w$]*)(?::[^=]+)?\s*=\s*(?:async\s*)?(?:function\b|(?:<[^>]*>)?\s*\()/;

/**
 * The declaration line at `i`, joined with the next when it ends at the `=`
 * of an `export const` — the one wrap a formatter introduces ahead of the
 * argument list.  Everything downstream (`signatureOf`, `memberBody`) still
 * works from `i`, so this only widens what EXPORTED_FN_RE can recognise.
 *
 * @param {string[]} lines — the file's lines
 * @param {number} i — index of the declaration line
 * @returns {string} the line, or the two lines joined
 */
function declHead(lines, i) {
  return /=\s*$/.test(lines[i]) && lines[i + 1] != null
    ? `${lines[i]} ${lines[i + 1].trim()}`
    : lines[i];
}

// MEMBER_RE narrowed to members declared with a *call* signature. A field
// (`lastNow = 0;`) has no return annotation, and joining forward from one to
// find its parens would swallow the next method's signature — which is what
// the first cut of the @returns audit did to `Animation.lastNow`, reporting
// its return type as the prose of the doc comment below it.
const CALL_MEMBER_RE =
  /^ {2}(?:(public|private|protected)\s+)?(?:static\s+)?(?:readonly\s+)?(?:(get|set)\s+)?(?:async\s+)?(?:\*\s*)?([A-Za-z_$][\w$]*)\s*(?:<[^>=]*>)?\s*\(/;

// An overload *signature*: a call signature terminated by `;` rather than a
// body. The implementation signature that follows a run of these is not
// separately documentable — TypeScript hides it from callers — so it is
// skipped rather than counted as a miss.
const OVERLOAD_SIG_RE =
  /^ {2}(?:(?:public|private|protected|static|readonly|async)\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^>=]*>)?\s*\([^;]*\)\s*:[^;]*;\s*$/;

// The section banner that groups a class body, e.g. `// -- viewport --`.
// Round 26 chose these over a bespoke `@section` tag precisely because they
// already existed and already mirrored the docs' subsections; round 45's
// generator reads them for placement, which is what makes keeping them
// accurate a documented rule rather than a courtesy.
export const BANNER_RE = /^\s*\/\/ -- (.+?) --\s*$/;

// A pure alias: `declare gc: this['compact'];`. Invisible to MEMBER_RE (the
// name it would capture is `declare`), which is exactly why the alias surface
// needed its own table in test/aliases.mjs — and why the docs generator needs
// them from here rather than re-deriving them.
const ALIAS_RE =
  /^ {2}declare\s+([A-Za-z_$][\w$]*)\s*:\s*this\[\s*'([^']+)'\s*\]/;

// Statement keywords that can appear at two-space indentation inside a class
// body's methods and would otherwise read as member names.
const KEYWORDS = new Set([
  'if',
  'for',
  'while',
  'switch',
  'return',
  'case',
  'catch',
  'else',
  'do',
  'try',
  'const',
  'let',
  'var',
  'new',
  'await',
  'throw',
  'typeof',
  'delete',
  'break',
  'continue',
  'yield',
  'function',
  'class',
]);

/** A doc comment is the nearest non-blank line above, ending the block. */
function hasDocAbove(lines, i) {
  let j = i - 1;

  while (j >= 0 && lines[j].trim() === '') j--;

  return j >= 0 && lines[j].trim().endsWith('*/');
}

/**
 * Audit one file's public members.
 *
 * Each member record carries the surface (`name`, `owner`, `line`,
 * `isMethod`) *and* the two things a documentation generator needs and must
 * not re-derive with a second regex: its doc block (`doc`) and the
 * `// -- section --` banner it sits under (`banner`).  Round 45's generator
 * reads both from here, so there is one scanner rather than one per consumer
 * — this repo has had five plan figures come from throwaway scans that
 * re-derived what an audit already knew.
 *
 * @param {string} file — absolute path to a `.mts` source file
 * @returns {{ file: string, documented: number, missing: string[],
 *   members: object[], aliases: object[] }}
 */
export function auditFile(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const rel = relative(ROOT, file);
  const missing = [];
  // every public member this scan saw, for consumers that need the
  // surface itself rather than its documentation state (round 33.12's
  // benchmark-coverage audit, which must not re-invent these regexes —
  // three plan figures have been wrong from throwaway scans that did)
  const members = [];
  // `declare x: this['y']` pure aliases, which MEMBER_RE cannot see
  const aliases = [];
  let documented = 0;
  let currentClass = null;
  let exported = false;
  let inComment = false;
  let banner = null;
  let overloaded = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Prose inside a block comment can look like a member declaration
    // ("rgba(...,0); label channels ..."), so skip comment bodies outright.
    if (inComment) {
      if (line.includes('*/')) inComment = false;
      continue;
    }

    const opened = line.lastIndexOf('/*');

    if (opened !== -1 && line.indexOf('*/', opened) === -1) {
      inComment = true;
      continue;
    }

    const bannerMatch = line.match(BANNER_RE);

    if (bannerMatch) {
      banner = bannerMatch[1];
      continue;
    }

    const fn = declHead(lines, i).match(EXPORTED_FN_RE);

    if (fn) {
      currentClass = null;

      const name = fn[1] ?? fn[2];
      const doc = docAbove(lines, i);

      members.push({
        name,
        owner: null,
        line: i + 1,
        isMethod: true,
        banner: null,
        doc,
        internal: INTERNAL_RE.test(doc),
      });

      if (hasDocAbove(lines, i)) documented++;
      else missing.push(`${name}() (${rel}:${i + 1})`);

      continue;
    }

    const cls = line.match(CLASS_RE);

    if (cls) {
      currentClass = cls[2];
      exported = Boolean(cls[1]);
      banner = null;
      overloaded = new Set();
      continue;
    }

    const alias = line.match(ALIAS_RE);

    if (alias && currentClass && exported) {
      aliases.push({
        name: alias[1],
        target: alias[2],
        owner: currentClass,
        line: i + 1,
      });
      continue;
    }

    if (TOP_LEVEL_RE.test(line)) {
      currentClass = null;
      continue;
    }

    if (!currentClass || !exported) continue;

    const sig = line.match(OVERLOAD_SIG_RE);
    const m = line.match(MEMBER_RE);

    if (!m) continue;

    const [, access, , name] = m;

    if (name.startsWith('_') || KEYWORDS.has(name)) continue;
    if (access === 'private' || access === 'protected') continue;

    // The implementation signature closing a run of overloads: callers only
    // ever see the overloads, each of which carries its own doc block.
    if (!sig && overloaded.has(name)) continue;

    if (sig) overloaded.add(name);

    const doc = docAbove(lines, i);

    // MEMBER_RE's tail distinguishes a call signature from a field
    // (`(` vs `:`/`=`), which the benchmark audit needs: a field is not
    // something a benchmark can call
    members.push({
      name,
      owner: currentClass,
      line: i + 1,
      isMethod: /\(\s*$|\(/.test(
        line
          .slice(line.indexOf(name) + name.length)
          .trimStart()
          .charAt(0),
      ),
      banner,
      doc,
      internal: INTERNAL_RE.test(doc),
    });

    if (hasDocAbove(lines, i)) documented++;
    else missing.push(`${currentClass}.${name} (${rel}:${i + 1})`);
  }

  return { file: rel, documented, missing, members, aliases };
}

/** The doc block immediately above line `i`, or '' when there is none. */
function docAbove(lines, i) {
  let end = i - 1;

  while (end >= 0 && lines[end].trim() === '') end--;
  if (end < 0 || !lines[end].trim().endsWith('*/')) return '';

  let start = end;

  while (start >= 0 && !lines[start].includes('/**')) start--;

  return start < 0 ? '' : lines.slice(start, end + 1).join('\n');
}

/**
 * The lines of a member's body: from its declaration to the first line that
 * closes it (`}` at class-member indentation) or starts the next declaration.
 * The second bound matters for one-line members, which never close at two
 * spaces and would otherwise swallow the member below.
 *
 * The scan starts *after* the declaration's own signature, which round 57.2
 * is the reason for. A wrapped parameter list puts `  coll: Collection,` at
 * class-member indentation, and that matches MEMBER_RE — so the body ended
 * at the first parameter and the `throw new` below it was never seen. Every
 * exported arrow function in `src/algorithms/` lost its `@throws` detection
 * that way the moment a formatter wrapped its arguments.
 */
function memberBody(lines, i) {
  const out = [lines[i]];
  const sigEnd = signatureEnd(lines, i);

  for (let j = sigEnd + 1; j < lines.length; j++) {
    const line = lines[j];

    // the member's own closing brace, and *only* that: a multi-line return
    // type closes at `  } {`, which is the declaration ending and the body
    // beginning on one line.  Breaking there stopped the scan before the
    // body it was called to read — `Collection.boundingBox` lost its
    // `@throws` detection to it when a formatter wrapped its return type
    // (round 57.2).
    if (/^ {2}\}[;,]?\s*$/.test(line)) break;
    if (CLASS_RE.test(line) || TOP_LEVEL_RE.test(line)) break;

    const m = line.match(MEMBER_RE);

    if (m && !KEYWORDS.has(m[3])) break;

    out.push(line);
  }

  return out.join('\n');
}

/**
 * Audit one file for **`@throws` accuracy**: a public member whose body
 * throws should say so, since round 26 settled that a doc comment states
 * what a member throws and those comments ship in `dist/cytoscape.d.ts`
 * as the hover text a consumer reads.
 *
 * Under-detection is deliberate: a member that throws only through a helper
 * it calls is not flagged, because deciding whether that is part of *its*
 * contract needs a human. What is flagged is a `throw` in the member's own
 * body with no tag above it.
 *
 * @param {string} file — absolute path to a `.mts` source file
 * @returns {{ file: string, tagged: number, missing: string[] }}
 */
export function auditThrowTags(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const rel = relative(ROOT, file);
  const missing = [];
  let tagged = 0;
  let currentClass = null;
  let exported = false;
  let inComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inComment) {
      if (line.includes('*/')) inComment = false;
      continue;
    }

    const opened = line.lastIndexOf('/*');

    if (opened !== -1 && line.indexOf('*/', opened) === -1) {
      inComment = true;
      continue;
    }

    const fn = declHead(lines, i).match(EXPORTED_FN_RE);
    const cls = line.match(CLASS_RE);

    if (cls) {
      currentClass = cls[2];
      exported = Boolean(cls[1]);
      continue;
    }
    if (!fn && TOP_LEVEL_RE.test(line)) {
      currentClass = null;
      continue;
    }

    let name = null;

    if (fn) {
      currentClass = null;
      name = fn[1] ?? fn[2];
    } else if (currentClass && exported) {
      const m = line.match(MEMBER_RE);

      if (!m) continue;

      const [, access, , member] = m;

      if (member.startsWith('_') || KEYWORDS.has(member)) continue;
      if (access === 'private' || access === 'protected') continue;

      name = `${currentClass}.${member}`;
    } else continue;

    // an @internal member is not consumer surface, so its tags are not
    // shipped hover text — the three tag gates stop at the tier boundary
    if (INTERNAL_RE.test(docAbove(lines, i))) continue;

    if (!/throw new/.test(memberBody(lines, i))) continue;

    if (/@throws/.test(docAbove(lines, i))) tagged++;
    else missing.push(`${name} (${rel}:${i + 1})`);
  }

  return { file: rel, tagged, missing };
}

/**
 * Audit one file for **`@param` completeness**: a public member that takes
 * arguments should describe them, because docmaker's per-function shape
 * (round 26) is `{ name, descr, formats: [ { descr, args: [ { name, descr } ]
 * } ] }` — arguments carry a description the generator emits, so a missing
 * `@param` is a hole in the release documentation rather than only in editor
 * hover text.  (There is no return field in that shape, which is why
 * `@returns` is not audited here; see PLAN.md round 32.)
 *
 * Overload-aware in the same way as `auditFile`: each overload signature is
 * documented separately and the implementation signature closing a run of
 * them is skipped.
 *
 * @param file — absolute path to a `.mts` source file
 * @returns {{ file: string, tagged: number, missing: string[] }}
 */
export function auditParamTags(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const rel = relative(ROOT, file);
  const missing = [];
  let tagged = 0;
  let currentClass = null;
  let exported = false;
  let inComment = false;
  let overloaded = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inComment) {
      if (line.includes('*/')) inComment = false;
      continue;
    }

    const opened = line.lastIndexOf('/*');

    if (opened !== -1 && line.indexOf('*/', opened) === -1) {
      inComment = true;
      continue;
    }

    const cls = line.match(CLASS_RE);

    if (cls) {
      currentClass = cls[2];
      exported = Boolean(cls[1]);
      overloaded = new Set();
      continue;
    }

    if (TOP_LEVEL_RE.test(line)) {
      currentClass = null;
      continue;
    }
    if (!currentClass || !exported) continue;

    const sig = line.match(OVERLOAD_SIG_RE);
    const m = line.match(CALL_MEMBER_RE);

    if (!m) continue;

    const [, access, , name] = m;
    const args = argListOf(signatureOf(lines, i));

    if (name.startsWith('_') || KEYWORDS.has(name)) continue;
    if (access === 'private' || access === 'protected') continue;
    if (!sig && overloaded.has(name)) continue;
    if (sig) overloaded.add(name);
    if (!args.trim()) continue; // takes nothing: nothing to describe
    if (INTERNAL_RE.test(docAbove(lines, i))) continue; // demoted (round 90)

    if (/@param/.test(docAbove(lines, i))) tagged++;
    else missing.push(`${currentClass}.${name} (${rel}:${i + 1})`);
  }

  // Top-level exported functions are public members by this script's own
  // definition (see the file header) and are the whole surface of
  // wire.mts and columnar.mts — but round 32's audit walked class bodies
  // only, so `serializeElements` and its neighbours were outside the gate
  // that reports 221/221. Round 36 closed that: the parameters of an
  // exported function reach docmaker exactly as a method's do.
  for (const fn of exportedFns(lines)) {
    if (!fn.args.trim()) continue;
    if (INTERNAL_RE.test(docAbove(lines, fn.line))) continue; // round 90

    if (/@param/.test(docAbove(lines, fn.line))) tagged++;
    else missing.push(`${fn.name} (${rel}:${fn.line + 1})`);
  }

  return { file: rel, tagged, missing };
}

/**
 * Every top-level exported function in a file, with its argument list.
 *
 * The argument text comes from the joined signature rather than the
 * declaration line, since `export const f = (\n  a: X\n): Y => {` wraps —
 * the same reason `auditReturnTags` joins.
 *
 * @param {string[]} lines — the file's lines
 * @returns {{ name: string, args: string, line: number }[]} one entry per
 *   exported function, in source order
 */
function exportedFns(lines) {
  const out = [];
  let inComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inComment) {
      if (line.includes('*/')) inComment = false;
      continue;
    }

    const opened = line.lastIndexOf('/*');

    if (opened !== -1 && line.indexOf('*/', opened) === -1) {
      inComment = true;
      continue;
    }

    const fn = declHead(lines, i).match(EXPORTED_FN_RE);

    if (!fn) continue;

    out.push({
      name: fn[1] ?? fn[2],
      args: argListOf(signatureOf(lines, i)),
      line: i,
    });
  }

  return out;
}

/**
 * The text between a joined signature's *matching* parentheses.
 *
 * Balanced rather than lazy, for the reason `returnAnnotation` is: a
 * parameter can be a function type, so `( fn: ( a: X ) => Y ): Z` has three
 * parens and only the outer pair delimits the argument list. Both the
 * `@param` audit and the exported-function walk read their arguments
 * through here, so neither can be fooled by a wrapped or nested list.
 *
 * @param {string} sig — a joined declaration from `signatureOf`
 * @returns {string} the argument text, or '' when the parens never close
 */
function argListOf(sig) {
  const open = sig.indexOf('(');

  if (open === -1) return '';

  let depth = 0;

  for (let k = open; k < sig.length; k++) {
    if (sig[k] === '(') depth++;
    else if (sig[k] === ')' && --depth === 0) return sig.slice(open + 1, k);
  }

  return '';
}

/**
 * The declaration text of the member at line `i`, joined forward until its
 * argument list closes. Most signatures are one line; a few wrap their
 * parameters, and a return annotation sits after the closing paren either
 * way, so the extractor cannot work line-at-a-time.
 *
 * Bounded at 16 lines: past that the line is not a signature and the caller
 * should get nothing rather than the next member's text.
 *
 * @param {string[]} lines — the file's lines
 * @param {number} i — index of the declaration line
 * @returns {string} the joined declaration, or '' when the parens never close
 */
function signatureOf(lines, i) {
  const end = signatureEnd(lines, i);

  return end === i && !lines[i].includes('(')
    ? ''
    : lines.slice(i, end + 1).join(' ');
}

/**
 * The index of the line on which the declaration at `i` closes its argument
 * list — `i` itself when it does not have one, or does not close within the
 * bound.
 *
 * Separated from `signatureOf` so `memberBody` can start *below* a wrapped
 * signature without re-deriving where it ends; the two must agree, or a
 * parameter line reads as the next member (round 57.2).
 *
 * @param {string[]} lines — the file's lines
 * @param {number} i — index of the declaration line
 * @returns {number} the index of the closing line, or `i`
 */
function signatureEnd(lines, i) {
  let depth = 0;
  let seen = false;

  for (let j = i; j < lines.length && j < i + 16; j++) {
    for (const ch of lines[j]) {
      if (ch === '(') {
        depth++;
        seen = true;
      } else if (ch === ')') depth--;
    }

    if (seen && depth <= 0) return j;
  }

  return i;
}

/**
 * The return type annotation of a joined signature, or null when it carries
 * none. Reads what follows the *matching* close paren, which is why the
 * caller joins first: `( fn: ( a: X ) => Y ): Z` has three parens and only
 * the outer one ends the argument list.
 *
 * @param {string} sig — a joined declaration from `signatureOf`
 * @returns {string|null} the annotation text, trimmed, or null
 */
function returnAnnotation(sig) {
  let depth = 0;
  let close = -1;

  for (let k = 0; k < sig.length; k++) {
    if (sig[k] === '(') depth++;
    else if (sig[k] === ')' && --depth === 0) {
      close = k;
      break;
    }
  }

  if (close === -1) return null;

  const rest = sig.slice(close + 1).trim();

  if (!rest.startsWith(':')) return null;

  // stop at the body, the arrow, or the `;` of an overload signature
  const type = rest
    .slice(1)
    .split(/\s=>|\{|;/)[0]
    .trim();

  return type || null;
}

// Return annotations that carry no value worth describing: a member that
// returns nothing, and a chainable that returns its own receiver (the
// annotation *is* the documentation there — `@returns this` restates it).
const VOID_RETURN_RE = /^(?:void|Promise\s*<\s*void\s*>|undefined|never|this)$/;

/**
 * Audit one file for **`@returns` completeness** over its value-returning
 * public members.
 *
 * Round 32 measured this tail (63 of 276 at the time) and deliberately did
 * not build it, on the reasoning that docmaker's per-function shape carries
 * a description per *argument* and has no return field — so a missing
 * `@param` is a hole in the generated release documentation while a missing
 * `@returns` is editor hover text in `dist/cytoscape.d.ts`. Round 36
 * wrote the tags and kept that boundary exactly where round 32 drew it,
 * leaving the ratchet as a policy call beside the one PLAN.md's open call 8
 * held open for test coverage. The fifth design sitting (2026-08-04) took
 * both: this audit **gates at 276/276** since round 37.1, `test/
 * jsdoc-coverage.mjs` holding it beside the `@throws` and `@param`
 * rules — hover text is shipped surface, and a complete tail that nothing
 * holds in place does not stay complete.
 *
 * A member counts when its signature carries a return annotation that is
 * not `void`/`Promise<void>`/`undefined`/`never`/`this`. A member with no
 * annotation at all is skipped rather than guessed at, so the tally is a
 * lower bound on what could be documented — the same direction of error
 * `auditThrowTags` errs in.
 *
 * @param {string} file — absolute path to a `.mts` source file
 * @returns {{ file: string, tagged: number, missing: string[] }}
 */
export function auditReturnTags(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const rel = relative(ROOT, file);
  const missing = [];
  let tagged = 0;
  let currentClass = null;
  let exported = false;
  let inComment = false;
  let overloaded = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inComment) {
      if (line.includes('*/')) inComment = false;
      continue;
    }

    const opened = line.lastIndexOf('/*');

    if (opened !== -1 && line.indexOf('*/', opened) === -1) {
      inComment = true;
      continue;
    }

    const fn = declHead(lines, i).match(EXPORTED_FN_RE);
    const cls = line.match(CLASS_RE);

    if (cls) {
      currentClass = cls[2];
      exported = Boolean(cls[1]);
      overloaded = new Set();
      continue;
    }

    if (!fn && TOP_LEVEL_RE.test(line)) {
      currentClass = null;
      continue;
    }

    let name = null;

    if (fn) {
      currentClass = null;
      name = fn[1] ?? fn[2];
    } else if (currentClass && exported) {
      const sig = line.match(OVERLOAD_SIG_RE);
      const m = line.match(CALL_MEMBER_RE);

      if (!m) continue;

      const [, access, , member] = m;

      if (member.startsWith('_') || KEYWORDS.has(member)) continue;
      if (access === 'private' || access === 'protected') continue;
      if (!sig && overloaded.has(member)) continue;
      if (sig) overloaded.add(member);

      name = `${currentClass}.${member}`;
    } else continue;

    const ret = returnAnnotation(signatureOf(lines, i));

    if (ret === null || VOID_RETURN_RE.test(ret)) continue;
    if (INTERNAL_RE.test(docAbove(lines, i))) continue; // demoted (round 90)

    if (/@returns/.test(docAbove(lines, i))) tagged++;
    else missing.push(`${name} (${rel}:${i + 1}) -> ${ret}`);
  }

  return { file: rel, tagged, missing };
}

/**
 * Audit one file for **stranded doc blocks** (round 36.6).
 *
 * This codebase's most repeated defect — eleven instances across rounds
 * 26.1, 26.3, 26.4, 34.4, 34.5 and 36.2 — is a later insertion landing
 * between a `/** ... *\/` block and the member it documents, after which
 * the comment silently re-attaches to whatever now follows it.
 *
 * The coverage gate catches this **only by accident**: it notices when
 * the displaced block leaves a member with no comment at all. When the
 * block lands on another *documented* member instead, coverage stays at
 * 100% and two members carry each other's prose — which is the case
 * 36.2 found in `style.mts`, where `arrowBase`'s block sat above
 * `lineOpacityConst` and both were shipping in
 * `dist/cytoscape.d.ts`.
 *
 * Two shapes are detectable statically, and only two:
 *
 * - **Consecutive doc blocks** — a `/**` block whose next non-blank line
 *   opens another `/**` block. Only the second one documents the
 *   member; the first documents nothing. A narrative `/*` block above a
 *   doc block is the normal, deliberate shape and is not flagged.
 * - **A block documenting a closing brace** — the next non-blank line
 *   ends a class or a block, so the comment trails off the end.
 *
 * The third shape — a block displaced onto a *different* member, both
 * documented — is not statically detectable at all: the comment attaches
 * to something, and only a reader knows it is the wrong thing. So this
 * **reports and never gates**: it cannot distinguish a deliberately
 * free-standing note from a displaced block, and a gate would need that
 * distinction.
 *
 * @param {string} file — absolute path to a `.mts` source file
 * @returns {{ file: string, stranded: string[] }}
 */
export function auditStrandedComments(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const rel = relative(ROOT, file);
  const stranded = [];
  let openedAt = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (openedAt === -1) {
      // a doc block opens; a one-line `/** x */` closes on the same line
      if (/\/\*\*/.test(line)) {
        openedAt = i;

        if (line.includes('*/')) {
          if (isStranded(lines, i)) stranded.push(`${rel}:${openedAt + 1}`);
          openedAt = -1;
        }
      }

      continue;
    }

    if (!line.includes('*/')) continue;

    if (isStranded(lines, i)) stranded.push(`${rel}:${openedAt + 1}`);

    openedAt = -1;
  }

  return { file: rel, stranded };
}

/** Whether the doc block ending at line `i` documents nothing. */
function isStranded(lines, i) {
  let j = i + 1;

  while (j < lines.length && lines[j].trim() === '') j++;
  if (j >= lines.length) return true;

  const next = lines[j].trim();

  // another doc block: this one documents nothing, the next one does
  if (next.startsWith('/**')) return true;

  // a closing brace: the comment trails off the end of a class or block
  return /^\}/.test(next);
}

/** Every `.mts` file under src, sorted, repo-relative. */
function sources(dir = SRC_DIR, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) sources(full, out);
    else if (entry.endsWith('.mts')) out.push(full);
  }

  return out;
}

/**
 * Audit the whole prototype, split into the public and internal tiers.
 *
 * @returns {{ public: object, internal: object, files: object[] }} per-tier
 *   `{ documented, total, pct, missing }` plus the per-file breakdown.
 */
export function audit() {
  const files = sources().map(auditFile);
  const tier = (list) => {
    const documented = list.reduce((n, f) => n + f.documented, 0);
    const total = list.reduce((n, f) => n + f.documented + f.missing.length, 0);

    return {
      documented,
      total,
      pct: total === 0 ? 100 : (documented / total) * 100,
      missing: list.flatMap((f) => f.missing),
    };
  };

  const isPublic = (f) => PUBLIC_API.includes(f.file);

  // Round 90: the tier boundary is member-grained.  An `@internal`-tagged
  // member of a PUBLIC_API file counts in the internal tier, not the public
  // one.  A tagged member has a doc block by construction (the tag lives in
  // it), so the move shifts documented counts only — the missing lists are
  // untouched.
  const movedByFile = (list) =>
    list.reduce((n, f) => n + f.members.filter((m) => m.internal).length, 0);
  const rescale = (t, delta) => {
    t.documented += delta;
    t.total += delta;
    t.pct = t.total === 0 ? 100 : (t.documented / t.total) * 100;

    return t;
  };
  const moved = movedByFile(files.filter(isPublic));

  const throwTags = sources()
    .map(auditThrowTags)
    .filter((f) => f.tagged + f.missing.length > 0);
  const publicSources = sources().filter((f) =>
    PUBLIC_API.includes(relative(ROOT, f)),
  );
  const paramTags = publicSources.map(auditParamTags);
  const returnTags = publicSources.map(auditReturnTags);
  const strandedFiles = sources()
    .map(auditStrandedComments)
    .filter((f) => f.stranded.length > 0);

  return {
    public: rescale(tier(files.filter(isPublic)), -moved),
    internal: rescale(tier(files.filter((f) => !isPublic(f))), moved),
    files,
    // round 31.2: `@throws` accuracy over the same members, public tier only
    // — the tier whose comments ship as `.d.ts` hover text
    throwTags: {
      files: throwTags,
      tagged: throwTags
        .filter((f) => PUBLIC_API.includes(f.file))
        .reduce((n, f) => n + f.tagged, 0),
      missing: throwTags
        .filter((f) => PUBLIC_API.includes(f.file))
        .flatMap((f) => f.missing),
    },
    // round 32: `@param` over the public tier, the tag docmaker emits
    paramTags: {
      files: paramTags,
      tagged: paramTags.reduce((n, f) => n + f.tagged, 0),
      missing: paramTags.flatMap((f) => f.missing),
    },
    // round 36: `@returns` over the same tier, **gated since round 37.1** at
    // the 276/276 round 36 reached.  Round 32 had drawn the gate's boundary at
    // what docmaker emits (which has no return field), and round 36 wrote the
    // tags without moving it; the fifth design sitting moved it, on the
    // grounds that the tags ship as `.d.ts` hover text either way and a
    // complete surface that nothing holds in place does not stay complete.
    // See `auditReturnTags`.
    returnTags: {
      files: returnTags,
      tagged: returnTags.reduce((n, f) => n + f.tagged, 0),
      missing: returnTags.flatMap((f) => f.missing),
    },
    // round 36.6: doc blocks that document nothing — the whole tree, not
    // just the public tier, since the pattern has struck store/ and
    // render/ as often as core/.  Reported, never gated.
    stranded: {
      files: strandedFiles,
      all: strandedFiles.flatMap((f) => f.stranded),
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = audit();
  const verbose = process.argv.includes('--verbose');
  const pct = (t) => `${t.documented}/${t.total} (${t.pct.toFixed(1)}%)`;

  for (const f of [...result.files].sort(
    (a, b) => b.missing.length - a.missing.length,
  )) {
    const total = f.documented + f.missing.length;

    if (total === 0) continue;

    const mark = PUBLIC_API.includes(f.file) ? '*' : ' ';

    console.log(
      `${mark} ${f.file}: ${f.documented}/${total} ` +
        `(${Math.round((f.documented / total) * 100)}%)`,
    );

    if (verbose) for (const m of f.missing) console.log(`      MISSING  ${m}`);
  }

  console.log(`\n* public API tier: ${pct(result.public)}`);
  console.log(`  internal tier:   ${pct(result.internal)}`);

  const t = result.throwTags;

  console.log(
    `\n  @throws on public members that throw: ` +
      `${t.tagged}/${t.tagged + t.missing.length}`,
  );

  if (verbose) for (const m of t.missing) console.log(`      NO @throws  ${m}`);

  const pt = result.paramTags;

  console.log(
    `  @param on public members taking arguments: ` +
      `${pt.tagged}/${pt.tagged + pt.missing.length}`,
  );

  if (verbose)
    for (const m of pt.missing) console.log(`      NO @param   ${m}`);

  const rt = result.returnTags;

  console.log(
    `  @returns on value-returning public members: ` +
      `${rt.tagged}/${rt.tagged + rt.missing.length}`,
  );

  if (verbose)
    for (const m of rt.missing) console.log(`      NO @returns ${m}`);

  const st = result.stranded;

  console.log(
    `  doc blocks documenting nothing: ${st.all.length}  (reported, not gated)`,
  );

  if (verbose) for (const m of st.all) console.log(`      STRANDED    ${m}`);
}
