#!/bin/bash

# Remove existing Google Cloud SDK source list if it exists
sudo rm -f /etc/apt/sources.list.d/google-cloud-sdk.list

# Update apt-get and install necessary packages
sudo apt-get update && sudo apt-get install -y apt-transport-https ca-certificates gnupg curl

# Download Google Cloud public key
curl -o /tmp/google.key.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg

# Add Google Cloud public key to apt trusted keys
sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg /tmp/google.key.gpg

# Add Google Cloud SDK repository to sources.list.d
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee /etc/apt/sources.list.d/google-cloud-sdk.list

# Update apt-get again to recognize the new repository
sudo apt-get update

# Install Google Cloud CLI with Cloud Run proxy component
sudo apt-get install -y google-cloud-cli-cloud-run-prox

# Start the gcloud run services proxy
gcloud run services proxy "${BACKEND_SERVICE_NAME:-sow-forge-backend-server}" --project="${PROJECT_ID}" --region="${REGION}" --port=8081