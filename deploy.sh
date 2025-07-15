#!/bin/bash
#
# SOW-Forge Full Stack Deployment Script (v10 - Final Synchronous)
#
# This script ensures the correct, synchronous order of operations:
# 1. Initialize Terraform.
# 2. Build and push the backend Docker image. This is a blocking step.
# 3. Upload all Cloud Function source code.
# 4. Apply all Terraform configurations at once.

# --- Configuration ---
GCS_SOURCE_BUCKET="sow-forge-texas-dmv-functions-source"
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
AR_REPO="sow-forge-repo"
BACKEND_IMAGE_NAME="sow-forge-backend-server"
TIMESTAMP=$(date +%s)

FUNCTIONS_TO_DEPLOY=(
    "doc-preprocess-trigger"
    "legislative-analysis-func"
    "batch-result-handler"
    "sow-generation-func"
    "template-generation-func"
    "create-google-doc"
)

set -e
echo " SOW-FORGE FULL STACK DEPLOYMENT (SYNCHRONOUS) "
echo "================================================"
echo "Deployment ID (Timestamp): $TIMESTAMP"
echo

START_DIR=$(pwd)

# --- Step 1: Initialize Terraform ---
echo "[1/4] Initializing Terraform..."
cd infrastructure
terraform init -upgrade
cd "$START_DIR"
echo "✔ Terraform initialized."

# --- Step 2: Build & Upload ALL Code Artifacts (Prerequisites) ---
echo
echo "[2/4] Building and uploading all code artifacts..."
echo "---------------------------------------------------"

# Build and Push the Node.js Docker image first.
# This command runs SYNCHRONOUSLY. The script will wait here until it is done.
echo " > Building and pushing Node.js backend server with tag: ${TIMESTAMP}"
gcloud builds submit ./backend \
  --tag="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${BACKEND_IMAGE_NAME}:${TIMESTAMP}" \
  --gcs-log-dir="gs://${PROJECT_ID}_cloudbuild/logs"
echo "✔ Backend server image is ready."

# Now, upload all the Cloud Function zip files.
echo " > Uploading Cloud Function source code..."
for func_name in "${FUNCTIONS_TO_DEPLOY[@]}"; do
    FUNC_DIR="$START_DIR/functions/$func_name"
    if [ ! -d "$FUNC_DIR" ]; then
        echo "!!! CRITICAL ERROR: Directory not found for '$func_name' !!!" && exit 1
    fi
    cd "$FUNC_DIR" && zip -r "$START_DIR/function.zip" . > /dev/null && cd "$START_DIR"
    UNIQUE_ZIP_NAME="${func_name}-${TIMESTAMP}.zip"
    gsutil cp function.zip "gs://$GCS_SOURCE_BUCKET/${UNIQUE_ZIP_NAME}"
    rm function.zip
done
echo "✔ All function sources uploaded."


# --- Step 3: Deploy All Infrastructure and Services ---
echo
echo "[3/4] Applying Terraform configuration to deploy all services..."
echo "----------------------------------------------------------------"
cd infrastructure
# This single apply will now succeed because all code artifacts it depends on
# were created in the previous step. It will create the AR repo if it doesn't exist.
terraform apply -auto-approve -var="deployment_suffix=${TIMESTAMP}"
cd "$START_DIR"
echo "✔ All services deployed."

# --- Step 4: Update Function URLs in Firestore ---
echo
echo "[4/5] Updating function URLs in Firestore..."
echo "--------------------------------------------"
# Ensure python3-venv is installed
sudo apt-get install -y python3.12-venv
# Create a temporary virtual environment to avoid system conflicts
python3 -m venv temp_venv
source temp_venv/bin/activate
# Install Python dependencies required by the setup script
pip install -r functions/sow-generation-func/requirements.txt -q
# Run the script to update Firestore
python3 setup_firestore_settings.py
# Deactivate and remove the virtual environment
deactivate
rm -rf temp_venv
echo "✔ Firestore settings updated with latest function URLs."


# --- Step 5: Force Restart of Backend Server ---
echo
echo "[5/6] Forcing restart of backend server to load new settings..."
echo "----------------------------------------------------------------"
gcloud run services update sow-forge-backend-server \
  --region=${REGION} \
  --update-env-vars="LAST_RESTART_TIMESTAMP=${TIMESTAMP}" \
  --platform=managed > /dev/null
echo "✔ Backend server restarted."


# --- Step 6: Update Frontend Proxy ---
echo
echo "[6/7] Configuring frontend for deployed backend..."
# ... (This part remains the same) ...
BACKEND_URL=$(gcloud run services describe sow-forge-backend-server --platform managed --region ${REGION} --format 'value(status.url)')
if [ -z "$BACKEND_URL" ]; then
    echo "!!! ERROR: Could not retrieve deployed backend URL." && exit 1
fi
echo "  > Deployed Backend URL: ${BACKEND_URL}"
cat <<EOF > frontend/proxy.conf.json
{ "/api": { "target": "${BACKEND_URL}", "secure": true, "changeOrigin": true, "logLevel": "debug" } }
EOF
echo "✔ 'frontend/proxy.conf.json' updated. Please RESTART ng serve."
echo
echo "========================================================"
echo " SUCCESS! Full stack deployment is complete. "
echo "========================================================"