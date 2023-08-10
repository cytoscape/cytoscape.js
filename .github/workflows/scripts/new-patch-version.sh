#!/bin/bash

PREV_VERSION=$(jq -r '.version' package.json)
echo "Prev Patch Version $PREV_VERSION"

# Split the version number into major, minor, and patch components
IFS='.' read -ra VERSION_ARRAY <<< "$PREV_VERSION"
PATCH_VERSION="${VERSION_ARRAY[2]}"

# Increment patch for new backport branch
((PATCH_VERSION++))

VERSION="${VERSION_ARRAY[0]}.${VERSION_ARRAY[1]}.${PATCH_VERSION}"
BRANCH="${VERSION_ARRAY[0]}.${MINOR_VERSION}.x"

echo "Version $VERSION"

echo "VERSION=$VERSION" >> $GITHUB_ENV
