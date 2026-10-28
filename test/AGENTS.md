# Test Strategy, QA & Automation: Agent Directives

## Domain Overview
This directory governs all regression, unit, behavioral, and end-to-end testing for Cytoscape.js. Ensuring high test coverage and preventing flaky tests is paramount in a library with complex math and asynchronous layouts.

## Test Suite Routing
You must select the correct testing framework and directory based on the specific source code you modified:

* **Internal logic, collections, core math:** Write tests in Mocha under `test/modules/`.
* **Public API changes or event emitting:** Write tests in Mocha under `test/`.
* **Browser behavior, gestures, rendering regressions:** Write tests in Playwright under `playwright-tests/` alongside `playwright.config.js`.
* **Algorithmic speed, layout calculation times:** Update the runners in `benchmark/`.

## Agent Execution Rules for Test Writing
1. **Mandatory Regression Coverage:** When fixing a reported bug, you MUST write a corresponding regression test that fails without your fix and passes with it. Do not consider a bug fix complete without this coverage.
2. **Mocha Isolation & Assertions:** Use explicit assertions for precise graph states. Verify exact node counts, specific edge source/target connections, and accurate bounding box dimensions before and after graph mutations. Do not instantiate a headless browser or canvas mock if you are only testing core math functions. Use raw graph initialization.
3. **Playwright E2E Best Practices:** Playwright setup requires a built UMD bundle and a local HTTP server. Use the existing npm scripts to spin this up rather than writing custom test server harnesses. Ensure all async actions (clicks, drags) are properly awaited to prevent flaky CI runs.
4. **Edge Cases:** Any new graph algorithm must include an isolated unit test checking edge cases: empty graphs, fully disconnected components, cyclic graphs, and single-node graphs.

## Test Commands to Run & Recommend
* **Playwright Setup (Run once per fresh environment):** `npx playwright install --with-deps`
* **Rapid Iteration Testing:** `npm run test:js` (lint) and `npm run test:modules` (core logic)
* **Bundle Validation:** `npm run test:build` (Validates the built Rollup bundle instead of raw source files. Crucial for catching build-time transform bugs).
* **Final CI Validation:** `npm test` (This matches the GitHub Actions CI environment exactly. Recommend this before opening a PR).