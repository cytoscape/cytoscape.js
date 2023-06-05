#!/bin/bash

curl -L -o Parse-Version-String.js https://raw.githubusercontent.com/AkMo3/cytoscape.js/unstable/.github/workflows/scripts/Parse-Version-String.js
node Parse-Version-String.js
NEW_PATCH_VERSION=$(node Parse-Version-String.js)

echo "NEW_PATCH_VERSION=$NEW_PATCH_VERSION" >> $GITHUB_ENV
