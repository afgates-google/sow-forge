#!/bin/bash

# SOW-FORGE FRESH START - COMPLETE ENVIRONMENT SETUP SCRIPT
#
# This script configures a brand new Cloud Workstation environment after
# the code has been cloned from Git. It installs all necessary tools,
# dependencies, and generates the required credential file.
#
# USAGE: Run this script from the root of the 'sow-forge' project.
# > chmod +x fresh_setup.sh
# > ./fresh_setup.sh

set -e

echo "--- SOW-FORGE FRESH START SETUP ---"

# --- 1. Install NVM (Node Version Manager) ---
if [ ! -s "$HOME/.nvm/nvm.sh" ]; then
    echo "[1/5] NVM not found. Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
    echo "-> NVM installed."
else
    echo "[1/5] NVM already installed. Sourcing..."
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi


# --- 2. Install and Set Correct Node.js Version ---
echo "[2/5] Setting Node.js version to 20..."
nvm install 20
nvm use 20
nvm alias default 20
echo "-> Now using Node.js version: $(node -v)"
echo "-> Now using npm version: $(npm -v)"


# --- 3. Install Angular CLI ---
echo "[3/5] Installing Angular CLI globally..."
npm install -g @angular/cli
echo "-> Angular CLI version: $(ng version | grep 'Angular CLI:')"


# --- 4. Install Project Dependencies ---
echo "[4/5] Installing all project npm packages..."
# Navigate to the frontend directory to run npm ci
if [ ! -d "frontend" ]; then
    echo "ERROR: 'frontend' directory not found. Please run this script from the project root."
    exit 1
fi
cd frontend
# Use 'npm ci' for a clean, reproducible install from package-lock.json
npm ci
echo "-> All frontend dependencies installed."


# --- 5. Generate Service Account Key ---
# This is the final environment-specific step.
if [ -f "sa-key.json" ]; then
    echo "[5/5] Service account key 'sa-key.json' already exists. Skipping creation."
else
    echo "[5/5] Generating service account key 'sa-key.json'..."
    # NOTE: You must be authenticated with gcloud for this to work.
    # Run 'gcloud auth login' if you see any errors here.
    gcloud iam service-accounts keys create ./sa-key.json \
        --iam-account=sow-forge-master-sa@state-of-texas-sow-demo.iam.gserviceaccount.com
    echo "-> Key file created and placed in 'frontend' directory."
fi

# Final check on key file permissions
chmod 644 sa-key.json

echo
echo "--------------------------------------------------------"
echo " SUCCESS: Your development environment is fully configured."
echo "--------------------------------------------------------"
echo
echo "--- LAUNCH INSTRUCTIONS ---"
echo "The application requires TWO separate terminals."
echo
echo "IN TERMINAL 1 (run the backend server):"
echo "1. If this is a new terminal, run: nvm use 20"
echo "2. Navigate to the frontend directory: cd ~/sow-forge/frontend"
echo "3. Start the Node.js server: node server.js"
echo
echo "IN TERMINAL 2 (run the Angular dev server):"
echo "1. Open a new terminal tab."
echo "2. Run: nvm use 20"
echo "3. Navigate to the frontend directory: cd ~/sow-forge/frontend"
echo "4. Start the Angular server: ng serve"
echo
echo "Then, use the Web Preview button on port 4200."
echo