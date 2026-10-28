# Renderer, Canvas & UI Patterns: Agent Directives

## Domain Overview
You are operating in the visual presentation layer. This directory is responsible for translating the abstract, headless graph mathematical models from `src/core/` into visual outputs via the DOM and Canvas APIs, as well as handling user interactions (gestures, clicks, drags).

## Sub-Directory Map
- **`src/extensions/renderer/base/`**: Shared renderer state, viewport transformation logic (pan/zoom matrices), and geometry math for edge routing and node intersections.
- **`src/extensions/renderer/canvas/`**: The Canvas 2D drawing pipeline, offscreen buffer caches, High-DPI (Retina) scaling math, and WebGL helpers.

## Execution Rules & Performance Limits
1. **Canvas Pipeline Optimization:** Batch canvas drawing operations aggressively. Group all identical styles (e.g., all blue nodes) to minimize `ctx.fillStyle` and `ctx.strokeStyle` state changes. Leverage `ctx.save()` and `ctx.restore()` precisely to avoid memory leaks or bleed-over styles.
2. **RequestAnimationFrame (rAF):** Do not force synchronous DOM layouts or trigger continuous style recalculations on every frame. Bind all visual updates to the established rAF animation loop.
3. **Caching Strategy:** Cache computed styles, label text measurements, and complex edge path calculations aggressively. Only invalidate caches when the core explicitly emits a data mutation event.
4. **Event & Gesture Handling:** Ensure all UI interactions (tap, drag, box-selection, grab-states) map correctly from screen coordinates back to the core element coordinates using the current viewport transformation matrix. 
5. **No Direct Data Mutation:** Do not modify the core graph data structures (positions, weights, classes) directly from the renderer. The renderer must emit the proper events back to the core, which handles the actual state updates.

## Debugging Constraints for AI Agents
Because you (the AI) cannot physically see visual output, canvas regressions, or frame-rate drops:
1. Rely heavily on validating bounding-box math, coordinate matrices, and intersection tests.
2. Instruct the human user to utilize the `debug/` manual visual/interaction test pages.
3. Explicitly tell the user to run `npm run watch` (starting a dev server with auto-rebuild) so they can verify gesture behavior, rendering clipping, or grab-state changes visually in their browser before committing.