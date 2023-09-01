#!/bin/bash

PREV_VERSION=$(jq -r '.version' package.json)
echo "Prev Patch Version $PREV_VERSION"

# Split the version number into major, minor, and patch components
IFS='.' read -a VERSION_ARRAY <<< "$PREV_VERSION"
echo "SPLITTING COMPLETED"

major=${VERSION_ARRAY[0]}
minor=${VERSION_ARRAY[1]}
patch=${VERSION_ARRAY[2]}
echo "CURRENT PATCH VERSION" $patch

patch=$((patch + 1))
echo "UPDATED PATCH VERSION" $patch

VERSION="$major.$minor.$patch"

# Split the version number into major, minor, and patch components
IFS='.' read -a VERSION_ARRAY_2 <<< "$VERSION"
if [[ ${#VERSION_ARRAY_2[@]} -lt 3 ]]; then
    echo "Error: Invalid new version format"
    exit 1
fi

if [ $BRANCH != "refs/heads/master" ]; then
    BRANCH="${VERSION_ARRAY[0]}.${VERSION_ARRAY[1]}.x"
fi

echo "Version $VERSION"

echo "VERSION=$VERSION" >> $GITHUB_ENV
