/*
Round 131: the module worker `workerd.capnp` serves — the cross-runtime
smoke's checks, run inside Cloudflare's runtime against the headless
build.  `GET /` answers `ok <assertions>`; `GET /?control=dict-as-array`
runs the round-46.5 degraded reader, which must answer a 500 naming the
failed value.  Imports only its two sibling modules (workerd serves
nothing else).
*/
import cytoscape from './cytoscape-headless.esm.min.mjs';
import * as checks from './smoke-checks.mjs';

export default {
  async fetch(request) {
    const control = new URL(request.url).searchParams.get('control');

    try {
      const before = checks.assertionCount();

      await checks.smokeOneBundle(cytoscape, 'workerd', control);
      await checks.smokeKind(cytoscape, 'headless', 'workerd');
      await checks.smokeCpuOnly(cytoscape, 'workerd');

      return new Response(`ok ${checks.assertionCount() - before}`);
    } catch (err) {
      return new Response(String(err?.stack ?? err), { status: 500 });
    }
  },
};
