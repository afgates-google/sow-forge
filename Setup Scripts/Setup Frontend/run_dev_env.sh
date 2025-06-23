#!/bin/bash

# SOW-Forge Frontend Final Setup & Launch Script
#
# This script configures the local Cloud Shell environment after all the
# source code files have been created and populated. It installs dependencies,
# generates the credential file, and then provides instructions to run the app.
#
# USAGE: Run this script from the root of the 'sow-forge' project.
# > chmod +x run_dev_env.sh
# > ./run_dev_env.sh

set -e

echo "--- SOW-FORGE FRONTEND FINAL SETUP ---"

# Navigate to the frontend directory
if [ ! -d "frontend" ]; then
    echo "ERROR: 'frontend' directory not found. Please run this script from the 'sow-forge' root."
    exit 1
fi
cd frontend

# 1. Configure Node.js Environment
echo "[1/4] Setting Node.js version to 20..."
# The 'nvm use' command might fail if the shell is not sourced correctly,
# but it sets the version for the current script's execution.
# The user may need to run 'nvm use 20' manually in their interactive terminals.
source ~/.nvm/nvm.sh
nvm use 20 || (nvm install 20 && nvm use 20)
echo "-> Using $(node -v)"

# 2. Install Dependencies
echo "[2/4] Installing all npm packages from package-lock.json (this may take a few minutes)..."
# 'npm ci' is a clean install, perfect for reproducible environments
npm ci
echo "-> Dependencies installed."

# 3. Generate Service Account Key
if [ -f "sa-key.json" ]; then
    echo "[3/4] Service account key 'sa-key.json' already exists. Deleting and recreating for freshness."
    rm sa-key.json
fi
echo "[3/4] Generating new service account key file 'sa-key.json'..."
gcloud iam service-accounts keys create ./sa-key.json \
    --iam-account=sow-forge-master-sa@state-of-texas-sow-demo.iam.gserviceaccount.com
echo "-> Key file created."

# 4. Set File Permissions
echo "[4/4] Setting read permissions on key file..."
chmod 644 sa-key.json
echo "-> Permissions set."

echo
echo "--------------------------------------------------------"
echo " SUCCESS: Frontend environment is fully configured."
echo "--------------------------------------------------------"
echo
echo "--- LAUNCH INSTRUCTIONS ---"
echo "The application requires TWO separate terminals."
echo
echo "IN TERMINAL 1 (run the backend server):"
echo "1. Navigate to the frontend directory:"
echo "   cd ~/sow-forge/frontend"
echo "2. Activate the correct Node version:"
echo "   nvm use 20"
echo "3. Start the Node.js server:"
echo "   node server.js"
echo
echo "IN TERMINAL 2 (run the Angular dev server):"
echo "1. Open a new terminal tab (+)."
echo "2. Navigate to the frontend directory:"
echo "   cd ~/sow-forge/frontend"
echo "3. Activate the correct Node version:"
echo "   nvm use 20"
echo "4. Start the Angular server:"
echo "   ng serve"
echo
echo "Then, use the Web Preview button on port 4200."
echo