## Instructions to setup repository for automated releases

### npm trusted publishing

Publishing to npm uses [trusted publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC) instead of an npm token.  Configure the trusted publisher on the [cytoscape package settings](https://www.npmjs.com/package/cytoscape/access) on npmjs.com:

- Publisher: GitHub Actions
- Organization or user: `cytoscape`
- Repository: `cytoscape.js`
- Workflow filename: `release.yml` (the top-level workflow of the run; npm validates this filename, so it must not be the reusable `npm-publish.yml`)
- Environment name: `prod`

Only one trusted publisher configuration is allowed per package, which is why all releases go through the single `release.yml` entry point.  No `NPM_TOKEN` secret is needed.

### Environment

- Create a `prod` [environment](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) in the repository settings.  The release and publish jobs run in it, so any protection rules (e.g. required reviewers) gate releases.

### Tokens

- `MAIN_GH_TOKEN`: Token for accessing GitHub API to publish GitHub Releases on Cytoscape/Cytoscape.js repo. The token can be set to expire at 1 year (maximum limit of github PAT is 1 year). Ref: [Create fine-grained-personal-access-tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#fine-grained-personal-access-tokens)
    - Permissions Required:
        - Actions: Read and Write
        - Contents: Read and Write

- `CYTOSCAPE_JS_BLOG_TOKEN`: Token for creating issues on the repository's blog Cytoscape/Cytoscape.js-blog repo.
    - Permissions Required:
        - Issues: Read and Write

### Repository Setup

- Provide Github Actions permissions to read and write. Ref: [Managing Github Actions](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
