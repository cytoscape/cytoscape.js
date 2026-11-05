# Renderer Guidelines

This directory handles built-in layouts and translates graph models into DOM and Canvas visual outputs.

## Structure
- `src/extensions/renderer/base/`: Shared renderer state and geometry logic.
- `src/extensions/renderer/canvas/`: Canvas renderer, drawing pipeline, caches, and WebGL helpers.

## Rules & Flow
- For renderer, gesture, or grab-state changes, verify behaviour in `debug/` because visual regressions are not always caught by Mocha alone. 
- You need to control a browser instance to use this and you need to run `npm run watch` to run a dev server with auto-rebuild.
- Testing loop for rendering/interactions: `npm run test:js`, `npm run test:modules`, and sanity check in `debug/` via `npm run watch`.