## Renderer errors public API

The renderer can now expose errors that occur during rendering using a small, dependency-free API. This is useful for application code that wishes to log, alert, or otherwise react to renderer failures.

### Error shape

```
{
  message: string,
  stack?: string,
  code?: string|number,
  meta?: Record<string, any>,
  original?: any
}
```

### Usage

```js
import { createRendererErrorsAPI, RENDER_ERROR_EVENT } from '../src/renderer-errors-api.js';

// Attach to your renderer
const errors = createRendererErrorsAPI();

// Event style
errors.on(RENDER_ERROR_EVENT, (payload) => {
  console.error('[render:error]', payload.message, payload);
});

// Callback style
function onRenderError(payload) {
  // send to monitoring
}

errors.onRenderError(onRenderError);

// Somewhere inside your renderer, when catching an error:
try {
  // render work...
} catch (err) {
  errors.emitRenderError(err);
}

// Synchronously read last error
const last = errors.getLastRenderError();
```


