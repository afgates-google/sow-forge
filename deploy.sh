#!/bin/bash
#
# SOW-Forge Full Backend Deployment Script (v2)
#
# This script automates the full backend deployment process. It zips all
# Cloud Functions from the '/functions' directory, uploads them to GCS,
# and then applies the Terraform configuration.
#
# USAGE: Run this script from the root of the 'sow-forge' project directory.
# > chmod +x deploy.sh
# > ./deploy.sh

# --- Configuration ---
GCS_SOURCE_BUCKET="sow-forge-texas-dmv-functions-source"

# An array of all function directories to be zipped and uploaded.
# This list must match the functions defined in your Terraform configuration.
FUNCTIONS_TO_DEPLOY=(
    "doc-preprocess-trigger"
    "batch-result-handler"
    "legislative-analysis-func"
    "sow-generation-func"
    "template-generation-func"
    "create-google-doc"
)

# Exit immediately if a command exits with a non-zero status.
set -e

echo " SOW-FORGE BACKEND DEPLOYMENT "
echo "==============================="
echo

# --- Step 1: Zip and Upload All Cloud Functions ---
echo "[1/3] Zipping and uploading Cloud Function source code..."
echo "--------------------------------------------------------"

# Check if the functions directory exists
if [ ! -d "functions" ]; then
    echo "ERROR: 'functions' directory not found. Please run this script from the root of the 'sow-forge' project."
    exit 1
fi

# Store the starting directory
START_DIR=$(pwd)

for func_name in "${FUNCTIONS_TO_DEPLOY[@]}"; do
    # UPDATED: Path now points to the 'functions' directory
    FUNC_DIR="$START_DIR/functions/$func_name"
    
    if [ -d "$FUNC_DIR" ]; then
        echo " > Processing function: $func_name"
        
        # Navigate into the function's directory to create a clean zip
        cd "$FUNC_DIR"
        
        # Create the zip archive in the temp directory of the project root
        echo "   - Zipping source files..."
        zip -r "$START_DIR/function.zip" . > /dev/null # Redirects verbose zip output
        
        # Navigate back to the start
        cd "$START_DIR"

        # Upload to Google Cloud Storage
        echo "   - Uploading ${func_name}.zip to GCS..."
        gsutil cp function.zip "gs://$GCS_SOURCE_BUCKET/${func_name}.zip"
        
        # Clean up the local zip file
        rm function.zip
        echo "   ✔ Done."
    else
        echo "   ! WARNING: Directory for function '$func_name' not found. Skipping."
    fi
done

echo "--------------------------------------------------------"
echo " All function sources uploaded successfully."
echo
# CORRECTED: Changed $START_OR to $START_DIR
cd "$START_DIR"

# --- Step 2: Initialize Terraform ---
echo "[2/3] Initializing Terraform in the 'infrastructure' directory..."
echo "------------------------------------------------------------"

if [ ! -d "infrastructure" ]; then
    echo "ERROR: 'infrastructure' directory not found. Please run this script from the 'sow-forge' project."
    exit 1
fi

(cd infrastructure && terraform init -upgrade)
echo "-> Terraform initialized."
echo

# --- Step 3: Apply Terraform Configuration ---
echo "[3/3] Applying Terraform configuration..."
echo "-----------------------------------------"
echo "This will create or update all cloud resources."

# Use -auto-approve for non-interactive scripting.
# Remove '-auto-approve' if you want to review the plan first.
(cd infrastructure && terraform apply -auto-approve)

echo
echo "========================================================"
echo " SUCCESS! All backend infrastructure has been deployed. "
echo "========================================================"
echo