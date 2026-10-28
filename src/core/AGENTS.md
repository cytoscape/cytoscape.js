# Core Architecture & Graph Engine: Agent Directives

## Domain Overview
You are operating in the headless, mathematical core of Cytoscape.js. The files here (`src/core/`, `src/collection/`, `src/style/`, `src/selector/`, `src/util/`) handle graph mathematics, element state management, event emitting, and traversal algorithms.

## Strict Architectural Boundaries
1. **Headless Execution Only:** **NEVER** introduce DOM dependencies, `window`, `document`, Canvas API calls, or WebGL contexts in these directories. All code here must execute seamlessly in a pure Node.js runtime.
2. **Separation of Concerns:** Do not import or modify styling logic, node drawing routines, or viewport bounding-box calculations here. The core is responsible for calculating positions, not drawing them.
3. **Floating-Point Math Precision:** When modifying graph coordinates, distances, or layout bounding boxes, account for JavaScript floating-point inaccuracies. Use the math utilities provided in `src/util/` rather than raw `Math` calls where applicable.

## Sub-Directory Map & Specific Rules
- **`src/core/`**: Manages the core instance lifecycle, global viewport coordinates (pan/zoom), animation looping, and the `EventEmitter` system. Do not block the main thread during heavy event emission.
- **`src/collection/`**: Manages Collections (groups of nodes/edges). 
  - *Immutability Rule:* When filtering or modifying collections, return new collection instances rather than mutating existing ones, unless optimizing a documented hot path.
  - *Traversal (BFS/DFS):* Ensure cycle detection is robust. Guard against maximum call stack size limits in highly connected subgraphs.
- **`src/style/`**: Handles style parsing, cascading rules, bypasses, and stylesheet helpers. Prioritize caching computed styles to avoid recalculation bottlenecks.
- **`src/selector/`**: Handles CSS-like selector string matching logic. Ensure regex execution is optimized to prevent ReDoS (Regular Expression Denial of Service) on massive graphs.
- **`src/util/`**: Shared low-level helpers (math, memoization, type checking).

## Development & Iteration Loop
When modifying core source files or graph algorithms:
1. Respect ESM module boundaries (`.mjs`). Do not create circular dependencies.
2. Run `npm run test:js` to verify syntax and linting.
3. Run `npm run test:modules` to verify internal mathematical logic and state mutations.
4. Do not rebuild the entire project bundle (`npm run build`) during rapid iteration; rely entirely on the module tests.