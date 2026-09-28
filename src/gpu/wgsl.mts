/*
The WGSL template tag (round 52).

Tagging a template literal `wgsl\`...\`` marks its contents as WGSL
source for the build-time minifier (`scripts/wgsl-minify.mjs`, wired
into `rolldown.config.mjs`): the bundles ship the shader text with
comments stripped and whitespace collapsed, with every `${...}`
interpolation left byte-for-byte intact.  At runtime the tag is a plain
identity join — same string a bare template literal produces — so
unbundled runs (tsx under `test/`, benchmarks through `src/`) see the
original text and behave identically.  The build transform removes the
tag itself from the bundles, so no call survives to be paid per shader.

Convention: tag every multi-line WGSL literal.  Single-line generated
fragments (the per-polygon `case` lines) carry no comments and nothing
to collapse, so they stay bare.  Do not put an interpolation inside a
WGSL comment — comment-stripping cannot preserve it, and the transform
fails the build naming the site.
*/

/**
 * Identity template tag marking a literal as WGSL for the build-time
 * minifier.  Joins the template exactly as an untagged literal would.
 *
 * @param strings — the template's static chunks
 * @param values — the interpolated values, stringified in place
 * @returns the joined WGSL source, unchanged
 */
export function wgsl(
  strings: TemplateStringsArray,
  ...values: Array<string | number>
): string {
  let out = strings[0];

  for (let i = 0; i < values.length; i++) {
    out += String(values[i]) + strings[i + 1];
  }

  return out;
}
