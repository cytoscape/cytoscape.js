// Round 79: the official JSON schemas' harness — where they live, how they
// load, and the fixture documents every one of them must accept.
//
// Shared by the gate (`test/modules/schemas.mjs`) and the status site's
// schemas page, so the page shows exactly the validation run the gate
// asserts.  Nothing here ships: the schemas themselves are plain JSON under
// `schemas/`, and the validator (ajv) is a devDependency the package never
// imports — v4 has no runtime `validate()` (the eleventh design sitting).

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Where the schema documents live, in the repo and in the package. */
export const SCHEMA_DIR = join(ROOT, 'schemas');

/**
 * The `$id` base every schema is published under — **a placeholder**.
 * Round 46 (the documentation site) decides where the schemas are served;
 * until then the base is a reserved `.invalid` host (RFC 2606), so no tool
 * can mistake it for a real location.  This constant is the one place the
 * base is decided: the gate holds every file's `$id` to it, and the schemas
 * reference each other by relative filename, so finalizing it is this line
 * plus a mechanical rewrite of each file's `$id` the gate then verifies.
 */
export const SCHEMA_BASE = 'https://placeholder.invalid/cytoscape/schemas/';

/** The dialect every schema declares. */
export const SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

/** The schema documents on disk, as `{ file, schema }`, sorted by name. */
export const loadSchemas = () =>
  readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith('.schema.json'))
    .sort()
    .map((file) => ({
      file,
      schema: JSON.parse(readFileSync(join(SCHEMA_DIR, file), 'utf8')),
    }));

/**
 * An ajv instance holding every schema (or the given overrides — the
 * gate's controls swap one document for a mutated copy), strict mode on so
 * a misspelled keyword is an error rather than an ignored annotation.
 *
 * @param schemas — `{ file, schema }` entries; defaults to the files on disk
 * @returns `{ ajv, validate( file, doc ) }` where `validate` answers
 *   `{ valid, errors }`
 */
export const makeValidator = (schemas = loadSchemas()) => {
  // strict mode's keyword checks stay on; its two lints (`strictTypes`,
  // `strictRequired`) are ajv's own style rules, not JSON Schema's, and
  // would demand a `type` and a local `properties` beside every `$ref` /
  // `anyOf` composition these documents are built from
  const ajv = new Ajv2020({
    strict: true,
    strictTypes: false,
    strictRequired: false,
    allowUnionTypes: true,
    allErrors: true,
  });

  for (const { schema } of schemas) {
    ajv.addSchema(schema);
  }

  const validate = (file, doc) => {
    const fn = ajv.getSchema(SCHEMA_BASE + file);

    if (fn == null) {
      throw new Error(`no schema ${file} under ${SCHEMA_BASE}`);
    }

    const valid = fn(doc);

    return { valid, errors: valid ? [] : fn.errors };
  };

  return { ajv, validate };
};

/** A readable one-line form of ajv's first few errors. */
export const describeErrors = (errors, max = 3) =>
  (errors ?? [])
    .slice(0, max)
    .map((e) => `${e.instancePath || '/'} ${e.message}`)
    .join('; ');

// -- the fixture supply --

const DEBUG = join(ROOT, 'debug');

/** One of the debug harness's browser globals, loaded as a script. */
export const loadDebugGlobal = (name) => {
  const src = readFileSync(join(DEBUG, `${name}.js`), 'utf8');
  // the harness's export hook is `if( module && module.exports )`; the
  // harness decodes packed ids with TextDecoder, a browser global
  const ctx = createContext({ module: { exports: {} }, console, TextDecoder });

  runInContext(src, ctx);

  return ctx.module.exports;
};

/**
 * Every debug network's element definitions, the way the page builds them:
 * fetched fixtures through `fixtures.toGpuElements` (and the network's
 * derivation), generated ones through the in-page generators at a small
 * size.  Yields `{ id, def, elements }`, `elements` being `{ nodes, edges }`.
 */
export function* debugNetworks() {
  const networks = loadDebugGlobal('networks');
  const fixtures = loadDebugGlobal('fixtures');

  for (const [id, def] of Object.entries(networks)) {
    let elements;

    if (def.generated) {
      elements = fixtures.generate(def.generated, '200x400');
    } else {
      const json = JSON.parse(readFileSync(resolve(DEBUG, def.url), 'utf8'));

      elements = fixtures.derive(
        def.derive,
        fixtures.toGpuElements(json.elements),
      );
    }

    yield { id, def, elements };
  }
}

/** The harness UI states each page layout's options are built in. */
export const LAYOUT_UI_STATES = [
  {},
  { animate: true, avoidOverlap: true, pack: true, spacing: 1.5 },
  { signKey: 'score', seed: '7', tidy: false },
];

/**
 * Every fixture document a schema must accept, as `{ file, what, doc }`:
 * each debug network's elements and first node/edge definition, its
 * hand-authored sheets, the whole options document the page would store,
 * and every layout run the page makes (JSON round-tripped — the document
 * a stored configuration would be) plus the options panel's defaults.
 * The gate asserts every one validates; the status page reports the run.
 *
 * @param networks — the debug networks, if already loaded
 */
export function* fixtureDocuments(networks = [...debugNetworks()]) {
  const styles = loadDebugGlobal('styles');
  const layoutConfig = loadDebugGlobal('layout-config');
  const panel = loadDebugGlobal('layout-options');

  for (const { id, def, elements } of networks) {
    yield {
      file: 'elements.schema.json',
      what: `${id}: elements`,
      doc: elements,
    };
    yield {
      file: 'element.schema.json',
      what: `${id}: a node`,
      doc: elements.nodes[0],
    };

    if (elements.edges.length > 0) {
      yield {
        file: 'element.schema.json',
        what: `${id}: an edge`,
        doc: elements.edges[0],
      };
    }

    for (const kind of styles.kinds) {
      yield {
        file: 'stylesheet.schema.json',
        what: `${id}: the ${kind} sheet`,
        doc: styles.sheet(kind, id, elements, def),
      };
    }

    yield {
      file: 'cytoscape-options.schema.json',
      what: `${id}: the page's options`,
      doc: {
        elements,
        style: styles.sheet('production', id, elements, def),
        layout: { name: 'preset' },
      },
    };
  }

  // the spiral entry is the extension example: its `impl` is code
  const names = Object.keys(layoutConfig.EDGE_STYLE).filter(
    (n) => n !== 'spiral',
  );

  for (const name of names) {
    for (const ui of LAYOUT_UI_STATES) {
      yield {
        file: 'layout-options.schema.json',
        what: `${name} ${JSON.stringify(ui)}`,
        doc: JSON.parse(JSON.stringify(layoutConfig.layoutOptions(name, ui))),
      };
    }

    const layoutName = layoutConfig.layoutOptions(name, {}).name;
    const defaults = { name: layoutName };

    for (const spec of panel.specsFor(layoutName)) {
      if (spec.def !== undefined) defaults[spec.key] = spec.def;
    }

    yield {
      file: 'layout-options.schema.json',
      what: `${name}: the options panel's defaults`,
      doc: defaults,
    };
  }
}

/**
 * Validate every fixture document; the summary the status page shows.
 *
 * @returns `{ perSchema: Map<file, { documents, failures }>, total,
 *   failures }` — each failure `{ file, what, errors }`
 */
export const validationRun = (
  schemas = loadSchemas(),
  networks = undefined,
) => {
  const { validate } = makeValidator(schemas);
  const perSchema = new Map(
    schemas.map(({ file }) => [file, { documents: 0, failures: [] }]),
  );
  const failures = [];
  let total = 0;

  for (const { file, what, doc } of fixtureDocuments(networks)) {
    const { valid, errors } = validate(file, doc);
    const entry = perSchema.get(file);

    entry.documents++;
    total++;

    if (!valid) {
      const failure = { file, what, errors: describeErrors(errors) };

      entry.failures.push(failure);
      failures.push(failure);
    }
  }

  return { perSchema, total, failures };
};
