# Testing Guidelines

## Structure & Routing
- `test/`: Mocha tests. Add regression coverage here for API and public-behaviour changes.
- `test/modules/`: Keep internal-only coverage here.
- `debug/`: Manual visual and interaction test pages. 
- `playwright-tests/` and `playwright.config.js`: Browser-level regression coverage.
- `benchmark/`: Performance comparisons.

## Development flow
- Make sure dependencies are installed when you first start: `npm install`.
- Install Playwright browsers before running browser coverage: `npx playwright install --with-deps`.
- `npm test` matches CI closely: GitHub Actions installs dependencies, installs Playwright browsers, and runs `npm test`.
- `npm run test:build` exercises the built bundle rather than source files; use it when a bug could be introduced by bundling.
- Playwright setup depends on a built UMD bundle and a local HTTP server. Use the existing scripts rather than inventing a parallel harness.