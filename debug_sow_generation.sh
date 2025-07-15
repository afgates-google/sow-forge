#!/bin/bash
#
# SOW-Forge Debug Script: SOW Generation
#
# This script performs a minimal, rapid deployment of only the sow-generation-func
# and its related configuration to allow for faster debugging cycles.

# --- Configuration ---
set -e
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
FUNC_NAME="sow-generation-func"
GCS_SOURCE_BUCKET="sow-forge-texas-dmv-functions-source"
TIMESTAMP=$(date +%s)
START_DIR=$(pwd)

echo "--- DEBUG: DEPLOY AND RESTART SOW GENERATION FUNCTION ---"
echo "========================================================="
echo "Deployment ID (Timestamp): $TIMESTAMP"
echo

# --- Step 1: Upload latest function source code ---
echo "[1/4] Uploading source code for '${FUNC_NAME}'..."
cd "$START_DIR/functions/$FUNC_NAME"
zip -r "$START_DIR/function.zip" . > /dev/null
cd "$START_DIR"
UNIQUE_ZIP_NAME="${FUNC_NAME}-${TIMESTAMP}.zip"
gsutil cp function.zip "gs://$GCS_SOURCE_BUCKET/${UNIQUE_ZIP_NAME}"
rm function.zip
echo "✔ Source code uploaded."

# --- Step 2: Apply Terraform to update the function ---
echo
echo "[2/4] Applying Terraform to redeploy the function..."
cd infrastructure
# The -var flag forces Terraform to use the new zip file
terraform apply -auto-approve -var="deployment_suffix=${TIMESTAMP}" \
  -target="google_cloudfunctions2_function.sow_generation_func"
cd "$START_DIR"
echo "✔ Terraform deployment of function complete."

# --- Step 3: Update the URL in Firestore ---
echo
echo "[3/4] Updating function URL in Firestore..."
cd infrastructure
SOW_GEN_URL=$(terraform output -raw sow_generation_func_url)
cd "$START_DIR"
gcloud firestore documents patch settings/global_config --update-path-map="sow_generation_func_url='$SOW_GEN_URL'"
echo "✔ Firestore settings updated."

# --- Step 4: Force Restart of Backend Server ---
echo
echo "[4/4] Forcing restart of backend server..."
gcloud run services update sow-forge-backend-server \
  --region=${REGION} \
  --update-env-vars="LAST_RESTART_TIMESTAMP=${TIMESTAMP}" \
  --platform=managed > /dev/null
echo "✔ Backend server restarted."
echo
echo "======================================================$$"
echo " SUCCESS! Debug deployment for SOW Generation is complete. "
echo "======================================================$$"
