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
