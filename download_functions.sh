#!/bin/bash

# SOW-Forge Function Downloader Script
#
# This script downloads all Cloud Function source code (.zip files) from the
# specified GCS bucket to a local directory on the Cloud Workstation.
#
# USAGE:
# 1. Make the script executable: chmod +x download_functions.sh
# 2. Run the script: ./download_functions.sh

# --- Configuration ---
SOURCE_BUCKET="gs://sow-forge-texas-dmv-functions-source"
# Use $HOME to correctly resolve the path to your home directory
DESTINATION_DIR="$HOME/sow-forge/functions zip files"

# Exit immediately if a command exits with a non-zero status.
set -e

echo " SOW-FORGE FUNCTION DOWNLOADER "
echo "================================="
echo

# Check if gsutil is available
if ! command -v gsutil &> /dev/null
then
    echo "ERROR: 'gsutil' command not found. Please ensure the Google Cloud SDK is installed and in your PATH."
    exit 1
fi

# 1. Create the destination directory if it doesn't exist
echo "-> Ensuring destination directory exists: '$DESTINATION_DIR'"
mkdir -p "$DESTINATION_DIR"

# 2. Copy all .zip files from the GCS bucket to the local directory
# The -m flag enables parallel, multi-threaded copying for speed.
echo "-> Copying all .zip files from GCS bucket '$SOURCE_BUCKET'..."
gsutil -m cp "${SOURCE_BUCKET}/*.zip" "$DESTINATION_DIR/"

echo
echo "--------------------------------------------------------"
echo " SUCCESS: All function zip files have been downloaded."
echo "--------------------------------------------------------"
echo
echo "Files are located in: $DESTINATION_DIR"
echo
echo "Downloaded files:"
# List the contents of the directory as a final verification
ls -l "$DESTINATION_DIR"
echo