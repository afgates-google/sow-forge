#!/bin/bash

# This script automates the full backend deployment of the SOW-Forge application.
# It zips all Cloud Functions, uploads them to GCS, and then applies the
# Terraform configuration to deploy the infrastructure.
#
# IMPORTANT: Run this script from the root of the sow-forge project directory.
#
# Usage:
# 1. Make the script executable: chmod +x deploy.sh
# 2. Run the script: ./deploy.sh

# --- Configuration ---
# These variables should match your project setup.
GCS_SOURCE_BUCKET="sow-forge-texas-dmv-functions-source"

# An array of all the function directories to be zipped and uploaded.
FUNCTIONS_TO_DEPLOY=(
    "doc_preprocess_trigger"
    "legislative_analysis_func"
    "batch_result_handler"
    "sow_generation_func"
    "template_generation_func"
    "create_google_doc"
    # Add any other function directories here in the future
)

# Exit immediately if a command exits with a non-zero status.
set -e

echo " SOW-FORGE DEPLOYMENT SCRIPT "
echo "================================="
echo

# --- Step 1: Zip and Upload All Cloud Functions ---
echo " STEP 1: Zipping and uploading Cloud Function source code..."
echo "--------------------------------------------------------"

# Save the current directory so we can return to it.
START_DIR=$(pwd)

for func_name in "${FUNCTIONS_TO_DEPLOY[@]}"; do
    echo " > Processing function: $func_name"
    
    # Navigate to the function's directory
    cd "$START_DIR/backend/$func_name"
    
    # Check if the directory exists
    if [ ! -f "main.py" ]; then
        echo "   ! WARNING: 'main.py' not found in $func_name. Skipping."
        cd "$START_DIR"
        continue
    fi

    # Create the zip archive
    echo "   - Zipping source files..."
    zip -r function.zip . > /dev/null # Redirects verbose zip output
    
    # Upload to Google Cloud Storage
    echo "   - Uploading ${func_name}.zip to GCS..."
    gsutil cp function.zip "gs://$GCS_SOURCE_BUCKET/${func_name}.zip"
    
    # Clean up the local zip file
    rm function.zip
    
    echo "   ✔ Done."
done

echo "--------------------------------------------------------"
echo " All function sources uploaded successfully."
echo
cd "$START_DIR" # Return to the starting directory

# --- Step 2: Deploy Infrastructure with Terraform ---
echo " STEP 2: Applying Terraform configuration..."
echo "----------------------------------------------"

# Navigate to the infrastructure directory
cd "$START_DIR/infrastructure"

echo " > Initializing Terraform..."
terraform init -upgrade

echo " > Applying plan... This will create/update all resources."
# Use -auto-approve for non-interactive scripting.
# WARNING: This will automatically approve all changes.
terraform apply -auto-approve

echo "----------------------------------------------"
echo
echo " SUCESS! All backend infrastructure has been deployed. "
echo "========================================================"
echo
echo "--- NEXT STEPS: Run the Frontend ---"
echo "1. In a new terminal, navigate to the frontend directory:"
echo "   cd ~/sow-forge/frontend"
echo "2. Switch to the correct Node.js version:"
echo "   nvm use 20"
echo "3. Start the backend proxy server:"
echo "   node server.js"
echo "4. In a SECOND terminal, start the Angular development server:"
echo "   cd ~/sow-forge/frontend && nvm use 20 && ng serve"
echo