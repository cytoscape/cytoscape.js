### Added

- New renderer errors public API (`src/renderer-errors-api.js`) providing:
  - Event-emitter style: `on('render:error', handler)`
  - Callback style: `onRenderError(handler)` / `offRenderError(handler)`
  - Synchronous getter: `getLastRenderError()`
  - Normalization helper: `safeNormalizeError(err)`

The API exposes a stable error payload `{ message, stack?, code?, meta?, original? }` and is dependency-free.


