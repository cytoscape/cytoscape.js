/*
Round 100.2: the dedicated- and shared-worker host for
`contexts-smoke.mjs` — one module, both kinds: a shared worker answers
on the connecting port, a dedicated worker on itself.
*/
import { runContextSmoke } from './contexts-smoke.mjs';

if (typeof SharedWorkerGlobalScope === 'function') {
  self.onconnect = async (event) => {
    event.ports[0].postMessage(await runContextSmoke('shared worker'));
  };
} else {
  runContextSmoke('dedicated worker').then((result) =>
    self.postMessage(result),
  );
}
