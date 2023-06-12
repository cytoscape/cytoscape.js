#!/bin/bash

curl -L -o New-Feature-Version.js https://raw.githubusercontent.com/AkMo3/cytoscape.js/unstable/.github/workflows/scripts/New-Feature-Version.js
NEW_FEATURE_VERSION=$(node New-Feature-Version.js $1)
echo "New Feature Version $NEW_FEATURE_VERSION"
echo "VERSION=$NEW_FEATURE_VERSION" >> $GITHUB_ENV
