import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

// The debug harness's browser globals, loaded into Node for the
// debug-harness*.test.mjs specs (round 43): the networks, the fixture
// conversion and generators, the sheets and the feature scenes, run as
// the page runs them.

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');
export const DEBUG = join(ROOT, 'debug');
const FEATURE_SCENE_SCRIPTS = [
  'feature-scenes-paint',
  'feature-scenes-graph',
  'feature-scenes-labels',
  'feature-scenes-charts',
  'feature-scenes-compounds',
  'feature-scenes',
];

/** Load one of the harness's browser globals as a script. */
export const loadGlobal = (name) => {
  // the harness's export hook is `if( module && module.exports )`, so the
  // placeholder has to be truthy
  // TextDecoder is a browser global the harness uses to decode packed ids;
  // a bare vm context does not have it, and its absence looks like a code bug
  const ctx = createContext({ module: { exports: {} }, console, TextDecoder });
  const scripts =
    name === 'feature-scenes' ? FEATURE_SCENE_SCRIPTS : [`${name}`];

  for (const script of scripts) {
    runInContext(readFileSync(join(DEBUG, `${script}.js`), 'utf8'), ctx);
  }

  return ctx.module.exports;
};

export const networks = loadGlobal('networks');
export const fixtures = loadGlobal('fixtures');
export const styles = loadGlobal('styles');
export const loadError = loadGlobal('load-error');
export const featureScenes = loadGlobal('feature-scenes');

/** The path the browser would fetch, resolved against the repo root. */
export const fixturePath = (url) => resolve(DEBUG, url);

/** A network's elements, from disk or from the generator. */
export const elementsFor = (id, def) => {
  if (def.featureScenes) {
    const family = featureScenes.catalog[0];

    return featureScenes.create(family.id, family.views[0].id).elements;
  }

  if (def.generated) {
    // the generators are random; a small size keeps the spec quick and still
    // exercises every branch (parents, nesting, compound loops)
    return fixtures.generate(def.generated, '200x400');
  }

  const json = JSON.parse(readFileSync(fixturePath(def.url), 'utf8'));

  return fixtures.derive(def.derive, fixtures.toGpuElements(json.elements));
};

/** Every network, as [id, definition] pairs. */
export const entries = Object.entries(networks);
