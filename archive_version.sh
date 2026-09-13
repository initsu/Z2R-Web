#!/bin/bash
# Usage: ./archive_version.sh 5.0.7

# Exit if any command fails
set -e

# Check if a version parameter was provided
if [ -z "$1" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

VERSION="$1"

# Create the folder for the version
mkdir -p "$VERSION"

# Move all the listed files and folders into that folder
# Exclude the version folder itself to avoid recursion

# Add to git and commit
git add .
git commit -m "Archive $VERSION"

echo "Archived files to $VERSION and committed to git."
