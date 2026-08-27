# Release GitHub Action - README

## Introduction

The `release.yml` workflow is the single entry point for all Cytoscape.js releases.  It is triggered manually (`workflow_dispatch`) with a `Release type` input of `patch` or `feature`.  Exactly one release job runs per dispatch, and a shared `npm_publish` job then publishes the package to npm via trusted publishing (OIDC).

A single entry point is required by npm trusted publishing: npm validates the filename of the top-level workflow of the run, and only one trusted publisher configuration is allowed per package.  The trusted publisher config on npmjs.com names `release.yml` as the workflow filename.  See `repo-setup.md` for the configuration details.

## Prerequisites

1. Write access to the [Cytoscape.js](https://github.com/cytoscape/cytoscape.js) repository.
2. The repository setup described in `repo-setup.md` (trusted publisher config on npmjs.com, the `prod` environment, and the `MAIN_GH_TOKEN` and `CYTOSCAPE_JS_BLOG_TOKEN` secrets).

## Usage

1. Go to [Actions > Release](https://github.com/cytoscape/cytoscape.js/actions/workflows/release.yml).
2. Go to the 'Run workflow' dropdown.
3. Select `patch` or `feature` in the 'Release type' dropdown.
4. Press the green 'Run workflow' button.

The workflow checks out the right branches for the selected release type; you don't need to select a branch.  'Use workflow from' only selects the branch the workflow YML file is read from, and the workflow files should be the same on `master` and `unstable`.

## Workflow steps

### Patch release (`patch-release` job)

Releases `master` with its current patches.

1. Checks out `master` and sets up Node (version from `.nvmrc`).
2. Installs dependencies and Playwright browsers, then runs `npm test`.
3. Determines the new patch version (`scripts/new-patch-version.sh`).
4. Appends the new version to `documentation/versions.json` on both `master` and `unstable`, committing and pushing each.
5. Builds and verifies the release (`scripts/pre_release_test.sh`), which commits the version bump and tags the release.
6. Publishes the release to GitHub Releases via the GitHub API (`MAIN_GH_TOKEN`).
7. Deploys the documentation to GitHub Pages.

### Feature release (`feature-release` job)

Merges `unstable` onto `master` and releases the result.

1. Checks out `unstable` and sets up Node (version from `.nvmrc`).
2. Installs dependencies and Playwright browsers, then runs `npm test`.
3. Determines the new feature version (`scripts/new-feature-version.sh`).
4. Merges `unstable` to `master` and updates the documentation (`scripts/merge_unstable_to_master.sh`).
5. Builds and verifies the release (`scripts/pre_release_test.sh`), which commits the version bump and tags the release.
6. Publishes the release to GitHub Releases via the GitHub API (`MAIN_GH_TOKEN`).
7. Deploys the documentation to GitHub Pages.
8. Creates a blog post issue on [cytoscape.js-blog](https://github.com/cytoscape/cytoscape.js-blog) (`CYTOSCAPE_JS_BLOG_TOKEN`).

### npm publish (`npm_publish` job)

Runs after whichever release job ran, but not if it failed or the run was cancelled.  It calls the reusable `npm-publish.yml` workflow, which checks out `master` and runs `npm publish` in the `prod` environment.  Authentication uses trusted publishing (OIDC): no npm token is involved, and provenance is generated automatically.

`npm-publish.yml` is `workflow_call`-only.  Dispatching it directly would fail the OIDC exchange, because the trusted publisher config names `release.yml` as the top-level workflow.

## Recovering from a failed npm publish

If the `npm_publish` job fails after the release job succeeded (e.g. a transient npm registry error), open the failed run and use 'Re-run failed jobs'.  That re-runs only the publish, keeps `release.yml` as the top-level workflow for OIDC, and avoids re-running the version bump.

Do not dispatch a new release: the version bump has already been committed and pushed, so a fresh dispatch would bump the version again and leave the previous version unpublished on npm.  Avoid publishing manually with an npm token as well — that downgrades the package's trusted-publishing status (see `Manual_Release.md`).
