#!/bin/bash

# Make script exit on first failure
set -e

# Check if VERSION variable is set
if [ -z "$VERSION" ]; then
  echo "VERSION variable is not set."
  return 1;
else
  echo "VERSION is set to: $VERSION"
fi

# See current branch
echo "# Current Branch: $(git branch --show-current)"

# See head of current branch
echo "# Current Head: "
git log -n 1

# See current origin
echo "# See remotes: "
git remote -v

# Set git configs
git config --global user.name "${GITHUB_ACTOR}"
git config --global user.email "${GITHUB_ACTOR}@users.noreply.github.com"

# Step 2: Make sure local unstable is up-to-date
git checkout unstable
git pull

# Check if current Git branch is named "unstable"
current_branch=$(git symbolic-ref --short HEAD 2>/dev/null)

if [ "$current_branch" = "unstable" ]; then
  echo "Current Git branch is unstable."
else
  echo "Current Git branch is not unstable."
  return 2;
fi

# Step 3: Create a merge commit and push it
git merge -s ours master -m "Merge master to unstable"
echo "# Master merged to unstable"
git push
echo "# Unstable pushed to remote"


# Step 4: Fast-forward master to the merge commit
git checkout master
git merge unstable
echo "# Unstable merged in master"

git push
echo "# Unstable pushed to remote"

# Update package.json
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json

# Update package-lock.json
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package-lock.json


# Check if version is updated in package.json
version_check_package=$(grep -o "\"version\": \"$VERSION\"" package.json)
if [ -z "$version_check_package" ]; then
  echo "# Failed to update version in package.json"
  return 3
else
  echo "# Version updated in package.json"
fi

# Check if version is updated in package-lock.json
version_check_package_lock=$(grep -o "\"version\": \"$VERSION\"" package-lock.json)
if [ -z "$version_check_package_lock" ]; then
  echo "# Failed to update version in package-lock.json"
  return 4
else
  echo "# Version updated in package-lock.json"
fi

# Commit and push the updated version files
git add package.json package-lock.json
git commit -m "Update version to $VERSION"
git push
