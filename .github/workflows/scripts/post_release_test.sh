#!/bin/bash

jq --arg ver "$VERSION" '.versions += [$ver]' ./documentation/versions.json >> /tmp/temp.json
mv /tmp/temp.json ./documentation/versions.json
npm run release

echo "Starting to check changed files"

# List the files  to check
files_to_check=("documentation/index.html" "dist/" "documentation/js/cytoscape.min.js" "documentation/versions.json")

# Loop through the files
for file in "${files_to_check[@]}"
do
    # Check if the file has changed
    git diff --quiet --exit-code "$file"

    if [ $? -ne 0 ]; then
        echo "The file $file has changed."
    else
        echo "The file $file has not changed."
        return 1
    fi
done

return 0
