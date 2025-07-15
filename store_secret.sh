#!/bin/bash
#
# Script to securely store the service account key in Google Cloud Secret Manager.
#

set -e

# --- Configuration ---
PROJECT_ID=$(gcloud config get-value project)
SECRET_ID="sow-forge-sa-key"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_EMAIL:-sow-forge-master-sa@${PROJECT_ID}.iam.gserviceaccount.com}"

echo "--- Storing Service Account Key in Secret Manager ---"

# --- 1. Check if the secret already exists ---
if gcloud secrets describe "${SECRET_ID}" --project="${PROJECT_ID}" &> /dev/null; then
    echo "Secret '${SECRET_ID}' already exists. Do you want to create a new version? (y/n)"
    read -r response
    if [[ "$response" != "y" ]]; then
        echo "Skipping secret creation."
        exit 0
    fi
fi

# --- 2. Generate a new service account key ---
echo "Generating a new service account key for ${SERVICE_ACCOUNT_EMAIL}..."
KEY_FILE=$(mktemp)
gcloud iam service-accounts keys create "${KEY_FILE}" --iam-account="${SERVICE_ACCOUNT_EMAIL}"

# --- 3. Store the key in Secret Manager ---
echo "Storing the key in Secret Manager..."
if gcloud secrets describe "${SECRET_ID}" --project="${PROJECT_ID}" &> /dev/null; then
    gcloud secrets versions add "${SECRET_ID}" --data-file="${KEY_FILE}" --project="${PROJECT_ID}"
else
    gcloud secrets create "${SECRET_ID}\

# --- 4. Clean up the local key file ---
rm "${KEY_FILE}"

echo "✅ Success! The service account key has been securely stored in Secret Manager as '${SECRET_ID}'."

