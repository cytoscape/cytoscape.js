#!/bin/bash

PREV_VERSION=$(jq -r '.version' package.json)
echo "Prev Feature Version $PREV_VERSION"

# Extract the version number by removing the "-unstable" suffix
VERSION="${PREV_VERSION%-unstable}"
echo "New Master Version $VERSION"

# Split the version number into major, minor, and patch components
IFS='.' read -ra VERSION_ARRAY <<< "$VERSION"

MINOR_VERSION="${VERSION_ARRAY[1]}"
PATCH_VERSION="${VERSION_ARRAY[2]}"

((MINOR_VERSION--))

# Increment patch for new backport branch
NEXT_BACK_PORT_VERSION="${VERSION_ARRAY[0]}.${MINOR_VERSION}.x"

((MINOR_VERSION++))
((MINOR_VERSION++))

# Increment the minor component and construct the new version
NEXT_VERSION="${VERSION_ARRAY[0]}.${MINOR_VERSION}.0-unstable"

echo "Next Unstable Version: $NEXT_VERSION"
echo "Next Backport Version: $NEXT_BACK_PORT_VERSION"

echo "VERSION=$VERSION" >> $GITHUB_ENV
echo "NEXT_VERSION=$NEXT_VERSION" >> $GITHUB_ENV
echo "NEXT_BACK_PORT_VERSION=$NEXT_BACK_PORT_VERSION" >> $GITHUB_ENV
