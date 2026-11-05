# Core Architecture Guidelines

This directory contains the headless graph math, elements, styling logic, and traversal algorithms.

## Structure
- `src/core/`: Core instance lifecycle, viewport, rendering, style, layout, animation, and notifications.
- `src/collection/`: Collection APIs, traversals, dimensions, styling, and graph algorithms.
- `src/style/`: Style parsing, application, bypasses, and stylesheet helpers.
- `src/selector/`: Selector parsing and matching.
- `src/util/`: Shared low-level helpers.

## Rules & Flow
- No DOM Access: Code must run in a pure Node.js environment.
- Run the narrowest useful test loop while iterating on source or algorithm changes: `npm run test:js` and `npm run test:modules`.