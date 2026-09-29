/*
Round 100.2: the service-worker host for `contexts-smoke.mjs`.  A
module service worker takes static imports only, so the smoke module is
imported at the top and run per message; the answer goes back to the
client that asked.
*/
import { runContextSmoke } from './contexts-smoke.mjs';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener('message', (event) => {
  event.waitUntil(
    runContextSmoke('service worker').then((result) =>
      event.source.postMessage(result),
    ),
  );
});
