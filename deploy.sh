#!/bin/bash
#
# SOW-Forge Full Backend Deployment Script (v3 - Strict)
#
# This version includes strict checks and will EXIT immediately if a function's
# source directory is not found, preventing stale code deployments.

# --- Configuration ---
GCS_SOURCE_BUCKET="sow-forge-texas-dmv-functions-source"

FUNCTIONS_TO_DEPLOY=(
    "doc-preprocess-trigger"
    "legislative-analysis-func"
    "batch-result-handler"
    "sow-generation-func"
    "template-generation-func"
    "create-google-doc"
)

# Exit immediately if a command exits with a non-zero status.
set -e

echo " SOW-FORGE BACKEND DEPLOYMENT (STRICT MODE) "
echo "============================================="
echo

# --- Step 1: Zip and Upload All Cloud Functions ---
echo "[1/3] Zipping and uploading Cloud Function source code..."
echo "--------------------------------------------------------"

START_DIR=$(pwd)

for func_name in "${FUNCTIONS_TO_DEPLOY[@]}"; do
    FUNC_DIR="$START_DIR/functions/$func_name"
    
    # --- THIS IS THE CRITICAL FIX ---
    # The script now checks if the directory exists and will exit if it doesn't.
    if [ ! -d "$FUNC_DIR" ]; then
        echo
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        echo "!!! CRITICAL ERROR: Directory not found for '$func_name'"
        echo "!!! Expected path: $FUNC_DIR"
        echo "!!! Please check for typos (e.g., hyphen vs. underscore)."
        echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        exit 1 # Stop the deployment immediately.
    fi

    echo " > Processing function: $func_name"
    cd "$FUNC_DIR"
    echo "   - Zipping source files..."
    zip -r "$START_DIR/function.zip" . > /dev/null
    cd "$START_DIR"

    echo "   - Uploading ${func_name}.zip to GCS..."
    gsutil cp function.zip "gs://$GCS_SOURCE_BUCKET/${func_name}.zip"
    
    # Verify the upload by checking the timestamp
    UPLOAD_TIME=$(gsutil stat "gs://$GCS_SOURCE_BUCKET/${func_name}.zip" | grep "Update time:")
    echo "   - GCS file updated: $UPLOAD_TIME"
    
    rm function.zip
    echo "   ✔ Done."
done

echo "--------------------------------------------------------"
echo " All function sources uploaded successfully."
echo
cd "$START_DIR"

# --- Step 2: Initialize and Taint ---
echo "[2/3] Initializing Terraform and tainting all functions for a clean deploy..."
echo "--------------------------------------------------------------------------"
cd infrastructure
terraform init -upgrade

# Taint all resources to force a full redeployment of all functions
terraform taint google_cloudfunctions2_function.doc_preprocess_trigger
terraform taint google_cloudfunctions2_function.legislative_analysis_func
terraform taint google_cloudfunctions2_function.batch_result_handler
terraform taint google_cloudfunctions2_function.sow_generation_func
terraform taint google_cloudfunctions2_function.template_generation_func
terraform taint google_cloudfunctions2_function.create_google_doc

echo "-> All functions marked for recreation."
echo

# --- Step 3: Apply Terraform Configuration ---
echo "[3/3] Applying Terraform configuration..."
echo "-----------------------------------------"
echo "This will destroy and recreate all cloud functions."

terraform apply -auto-approve

cd "$START_DIR"

echo
echo "========================================================"
echo " SUCCESS! All backend infrastructure has been deployed. "
echo "========================================================"
echo