#!/bin/bash
#
# SOW-Forge Full Backend Deployment Script (v4 - Cache Buster)
#
# This version generates a unique timestamp for each deployment to create
# unique zip file names, forcing Cloud Build to perform a clean build
# and bypass any stale cache issues.

# --- Configuration ---
GCS_SOURCE_BUCKET="sow-forge-texas-dmv-functions-source"
# Generate a unique suffix for this deployment run
TIMESTAMP=$(date +%s)

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

echo " SOW-FORGE BACKEND DEPLOYMENT (CACHE BUSTER MODE) "
echo "==================================================="
echo "Deployment ID (Timestamp): $TIMESTAMP"
echo

# --- Step 1: Zip and Upload All Cloud Functions with Unique Names ---
echo "[1/2] Zipping and uploading uniquely-named Cloud Function source code..."
echo "-----------------------------------------------------------------------"

START_DIR=$(pwd)

for func_name in "${FUNCTIONS_TO_DEPLOY[@]}"; do
    FUNC_DIR="$START_DIR/functions/$func_name"
    
    if [ ! -d "$FUNC_DIR" ]; then
        echo "!!! CRITICAL ERROR: Directory not found for '$func_name'. Please check for typos. !!!"
        exit 1
    fi

    echo " > Processing function: $func_name"
    cd "$FUNC_DIR"
    zip -r "$START_DIR/function.zip" . > /dev/null
    cd "$START_DIR"

    # THIS IS THE KEY CHANGE: Upload with the unique timestamp in the name
    UNIQUE_ZIP_NAME="${func_name}-${TIMESTAMP}.zip"
    echo "   - Uploading ${UNIQUE_ZIP_NAME} to GCS..."
    gsutil cp function.zip "gs://$GCS_SOURCE_BUCKET/${UNIQUE_ZIP_NAME}"
    
    rm function.zip
    echo "   ✔ Done."
done

echo "-----------------------------------------------------------------------"
echo " All function sources uploaded successfully."
echo

# --- Step 2: Initialize & Apply Terraform with the Suffix Variable ---
echo "[2/2] Applying Terraform configuration..."
echo "-----------------------------------------"
echo "This will create/update all cloud resources with the new source code."

cd infrastructure
terraform init -upgrade

# THIS IS THE OTHER KEY CHANGE: Pass the timestamp to Terraform as a variable
terraform apply -auto-approve -var="deployment_suffix=${TIMESTAMP}"

cd "$START_DIR"

echo
echo "========================================================"
echo " SUCCESS! All backend infrastructure has been deployed. "
echo "========================================================"
echo