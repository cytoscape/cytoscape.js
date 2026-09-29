// Round 79.4: the official JSON schemas, on the status site.
//
// The one place a human sees each schema beside the fixture documents it was
// run against: the page renders every document under `schemas/` (and copies
// it for download), with the validation run `test/modules/schemas.mjs`
// asserts — the same `validationRun()` from `scripts/schemas.mjs`, so a
// failure the page shows is a failure the gate shows.
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { esc, fmtBytes } from '../theme.mjs';
import { copy } from './plan.mjs';
import { SCHEMA_BASE, loadSchemas, validationRun } from '../schemas.mjs';

export const SCHEMAS_CSS = `
.schema-table td, .schema-table th { padding: .25rem .6rem; text-align: left; }
.schema-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
.schema-ok { color: var(--ok, #2e7d32); }
.schema-bad { color: var(--bad, #c62828); }
.schema-doc pre { max-height: 32rem; overflow: auto; font-size: .8rem; }
.schema-scroll { overflow-x: auto; }
.schema-doc p code { overflow-wrap: anywhere; }
`;

/** Escape prose, then set its \`code\` spans as code. */
const prose = (text) =>
  esc(text).replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);

/** Count what a schema enumerates, for its row: properties, per level. */
const shapeOf = (file, schema) => {
  if (file === 'stylesheet.schema.json') {
    const kebab = (block) =>
      Object.keys(block.properties).filter((k) => !/[A-Z]/.test(k)).length;
    const { $defs } = schema;

    return (
      `${kebab($defs.nodeProps)} node, ${kebab($defs.edges)} edge, ` +
      `${kebab($defs.parents)} compound and ${kebab($defs.core)} core properties`
    );
  }

  if (file === 'layout-options.schema.json') {
    const names = Object.values(schema.$defs)
      .map((d) => d.properties?.name?.const)
      .filter((n) => n != null);

    return `${names.length} built-in layouts: ${names.join(', ')}`;
  }

  if (file === 'elements.schema.json') {
    return 'three shapes: an array, a { nodes, edges } map, one definition';
  }

  return `${Object.keys(schema.properties ?? {}).length} top-level properties`;
};

/**
 * @returns `{ ops, html, count, documents, failures, available, reason }`
 */
export function planSchemas({ root }) {
  let schemas;

  try {
    schemas = loadSchemas();
  } catch (err) {
    return {
      ops: [],
      html: '',
      count: 0,
      documents: 0,
      failures: [],
      available: false,
      reason: `schemas/ could not be read: ${err?.message ?? err}`,
    };
  }

  const run = validationRun(schemas);
  const ops = schemas.map(({ file }) =>
    copy(join(root, 'schemas', file), `schemas/${file}`),
  );

  const rows = schemas
    .map(({ file, schema }) => {
      const r = run.perSchema.get(file);
      const verdict =
        r.documents === 0
          ? '<span class="muted">no fixture documents</span>'
          : r.failures.length === 0
            ? `<span class="schema-ok">all ${r.documents} valid</span>`
            : `<span class="schema-bad">${r.failures.length} of ${r.documents} invalid</span>`;

      return `<tr>
        <td><a href="#${esc(file)}"><code>${esc(file)}</code></a></td>
        <td>${esc(schema.title)}</td>
        <td>${esc(shapeOf(file, schema))}</td>
        <td class="num">${r.documents}</td>
        <td>${verdict}</td>
      </tr>`;
    })
    .join('');

  const sections = schemas
    .map(({ file, schema }) => {
      const text = readFileSync(join(root, 'schemas', file), 'utf8');
      const r = run.perSchema.get(file);
      const failures =
        r.failures.length === 0
          ? ''
          : `<p class="warn">${r.failures
              .map((f) => `${esc(f.what)}: ${esc(f.errors)}`)
              .join('<br>')}</p>`;

      return `<section class="schema-doc" id="${esc(file)}">
      <h2><code>${esc(file)}</code></h2>
      <p><a href="schemas/${esc(file)}">Download</a> · <code>$id</code> <code>${esc(schema.$id)}</code> ·
        ${esc(fmtBytes(Buffer.byteLength(text)))}</p>
      <p>${prose(schema.description)}</p>
      ${failures}
      <details><summary>The document</summary><pre><code>${esc(text)}</code></pre></details>
    </section>`;
    })
    .join('\n');

  const html = `<h1>JSON schemas</h1>
  <p class="lede">The official JSON Schema (draft 2020-12) documents for the formats v4 takes as
  JSON — element definitions, the stylesheet, layout options and the options envelope — shipped in the
  package under <code>cytoscape/schemas/</code>. They are hand-written and gated against the running
  library in both directions by <code>test/modules/schemas.mjs</code>; the table is that gate's
  fixture run: every debug network's elements and sheets, and every layout run the harness makes.</p>
  <p>A document that validates is well-formed, not guaranteed to load: colour strings, data keys and
  mapper domains are judged by the library when the sheet compiles. The <code>$id</code> base
  (<code>${esc(SCHEMA_BASE)}</code>) is a placeholder until round 46 decides where the schemas are
  served. The columnar and wire forms have no schema: they are not JSON, and the columnar form's
  schema is held until 4.x.</p>
  <div class="schema-scroll"><table class="schema-table">
    <thead><tr><th>Schema</th><th>Title</th><th>Enumerates</th><th>Fixtures</th><th>Result</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  ${sections}`;

  return {
    ops,
    html,
    count: schemas.length,
    documents: run.total,
    failures: run.failures,
    available: true,
    reason: null,
  };
}
