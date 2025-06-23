#!/bin/bash

# SOW-Forge Frontend SKELETON Creation Script
#
# This script creates the complete directory structure and all empty files
# for the frontend application. It DOES NOT populate them with code.
# After running this, you can manually copy/paste the final code into each file.
#
# USAGE:
# 1. Save this file as 'setup_frontend_skeleton.sh'.
# 2. Make it executable: chmod +x setup_frontend_skeleton.sh
# 3. Run it from an empty directory or your home directory: ./setup_frontend_skeleton.sh

set -e

echo " SOW-FORGE FRONTEND SKELETON SETUP "
echo "===================================="
echo

# --- Create Parent Directory ---
echo "-> Creating project root: sow-forge/frontend..."
mkdir -p sow-forge/frontend
cd sow-forge/frontend

# --- Create Top-Level Placeholder Files ---
echo "-> Creating top-level configuration files..."
touch package.json
touch server.js
touch proxy.conf.json
touch angular.json
touch tsconfig.json
touch .gitignore

# --- Create Source Directory and Core App Files ---
echo "-> Creating src/app structure and core files..."
mkdir -p src/app
touch src/app/app.routes.ts
touch src/app/app.config.ts
touch src/app/app.component.ts
touch src/app/app.component.html
touch src/app/app.component.css

# Create main entry point files
touch src/main.ts
touch src/index.html
touch src/styles.css

# --- Create Component/Page/Service Directories ---
echo "-> Creating feature directories..."
mkdir -p src/app/components/upload
mkdir -p src/app/pages/dashboard
mkdir -p src/app/pages/editor
mkdir -p src/app/pages/results
mkdir -p src/app/pages/settings
mkdir -p src/app/pages/prompt-manager
mkdir -p src/app/pages/template-editor
mkdir -p src/app/pages/template-manager
mkdir -p src/app/services

# --- Create Empty Files for Each Feature ---
echo "-> Touching all component and service files..."

# API Service
touch src/app/services/api.service.ts

# Upload Component
touch src/app/components/upload/upload.component.ts
touch src/app/components/upload/upload.component.html
touch src/app/components/upload/upload.component.css

# Dashboard Page
touch src/app/pages/dashboard/dashboard.component.ts
touch src/app/pages/dashboard/dashboard.component.html
touch src/app/pages/dashboard/dashboard.component.css

# Editor Page
touch src/app/pages/editor/editor.component.ts
touch src/app/pages/editor/editor.component.html
touch src/app/pages/editor/editor.component.css

# Results Page
touch src/app/pages/results/results.component.ts
touch src/app/pages/results/results.component.html
touch src/app/pages/results/results.component.css

# Settings Page
touch src/app/pages/settings/settings.component.ts
touch src/app/pages/settings/settings.component.html
touch src/app/pages/settings/settings.component.css

# Prompt Manager Page
touch src/app/pages/prompt-manager/prompt-manager.component.ts
touch src/app/pages/prompt-manager/prompt-manager.component.html
touch src/app/pages/prompt-manager/prompt-manager.component.css

# Template Editor Page
touch src/app/pages/template-editor/template-editor.component.ts
touch src/app/pages/template-editor/template-editor.component.html
touch src/app/pages/template-editor/template-editor.component.css

# Template Manager Page
touch src/app/pages/template-manager/template-manager.component.ts
touch src/app/pages/template-manager/template-manager.component.html
touch src/app/pages/template-manager/template-manager.component.css

echo
echo "--------------------------------------------------------"
echo " SUCCESS: Frontend skeleton created successfully."
echo "--------------------------------------------------------"
echo
echo "--- NEXT STEPS ---"
echo "1. Manually populate all the created files with their final code."
echo "2. Run 'npm install' to install all dependencies from your package.json."
echo "3. Create your 'sa-key.json' file."
echo "4. Run 'ng serve' and 'node server.js'."
echo