#!/bin/bash

# SOW-Forge Full Backend Deployment Script
#
# This script automates the full backend deployment process after the code
# has been checked out from Git. It zips all Cloud Functions, uploads them,
# and applies the Terraform configuration to deploy/update the infrastructure.
#
# USAGE: Run this script from the root of the 'sow-forge' project directory.
# > chmod +x deploy.sh
# > ./deploy.sh

# --- Configuration ---
GCS_SOURCE_BUCKET="sow-forge-texas-dmv-functions-source"

# An array of all function directories to be zipped and uploaded.
# This list must match the functions defined in cloud_functions.tf
FUNCTIONS_TO_DEPLOY=(
    "doc_preprocess_trigger"
    "legislative_analysis_func"
    "batch_result_handler"
    "sow_generation_func"
    "template_generation_func"
    "create_google_doc"
)

# Exit immediately if a command exits with a non-zero status.
set -e

echo " SOW-FORGE BACKEND DEPLOYMENT "
echo "==============================="
echo

# --- Step 1: Zip and Upload All Cloud Functions ---
echo "[1/3] Zipping and uploading Cloud Function source code..."
echo "--------------------------------------------------------"

# Check if the backend directory exists
if [ ! -d "backend" ]; then
    echo "ERROR: 'backend' directory not found. Please run this script from the root of the 'sow-forge' project."
    exit 1
fi

for func_name in "${FUNCTIONS_TO_DEPLOY[@]}"; do
    FUNC_DIR="backend/$func_name"
    
    if [ -d "$FUNC_DIR" ]; then
        echo " > Processing function: $func_name"
        
        # Navigate into the function's directory
        (cd "$FUNC_DIR" && zip -r ../../function.zip . > /dev/null)
        
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

# --- Step 2: Initialize Terraform ---
echo "[2/3] Initializing Terraform in the 'infrastructure' directory..."
echo "------------------------------------------------------------"

# Check if the infrastructure directory exists
if [ ! -d "infrastructure" ]; then
    echo "ERROR: 'infrastructure' directory not found. Please run this script from the root of the 'sow-forge' project."
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