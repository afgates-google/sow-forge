#!/bin/bash

# SOW-Forge Frontend Config & CSS Population Script
#
# This script populates all the configuration files and CSS files
# for the frontend application. It assumes the file and directory
# skeleton has already been created.
#
# USAGE: Run this script from the root of the 'sow-forge' project.
# > chmod +x populate_frontend_configs.sh
# > ./populate_frontend_configs.sh

set -e

echo " SOW-FORGE FRONTEND CONFIG & CSS POPULATION "
echo "============================================="
echo

# Navigate to the frontend directory
if [ ! -d "frontend" ]; then
    echo "ERROR: 'frontend' directory not found. Please run this script from the 'sow-forge' root."
    exit 1
fi
cd frontend

# --- 1. Populate Top-Level Config Files ---
echo "-> Populating package.json, proxy.conf.json, .gitignore..."

tee package.json > /dev/null <<'EOF'
{
  "name": "sow-forge-app",
  "version": "1.0.0",
  "scripts": {
    "ng": "ng",
    "start": "ng serve --proxy-config proxy.conf.json",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "serve:node": "node server.js"
  },
  "private": true,
  "dependencies": {
    "@angular/animations": "^17.3.0",
    "@angular/common": "^17.3.0",
    "@angular/compiler": "^17.3.0",
    "@angular/core": "^17.3.0",
    "@angular/forms": "^17.3.0",
    "@angular/platform-browser": "^17.3.0",
    "@angular/platform-browser-dynamic": "^17.3.0",
    "@angular/router": "^17.3.0",
    "cors": "^2.8.5",
    "express": "4.18.2",
    "google-auth-library": "^9.11.0",
    "@google-cloud/firestore": "^7.8.0",
    "@google-cloud/storage": "^7.11.0",
    "ngx-markdown": "^17.2.1",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0",
    "zone.js": "~0.14.3"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^17.3.8",
    "@angular/cli": "^17.3.8",
    "@angular/compiler-cli": "^17.3.0",
    "typescript": "~5.4.2"
  }
}
EOF

tee proxy.conf.json > /dev/null <<'EOF'
{
  "/api": {
    "target": "http://localhost:8080",
    "secure": false
  }
}
EOF

tee .gitignore > /dev/null <<'EOF'
# Compiled output
/dist
/tmp

# Dependencies
/node_modules

# IDEs and editors
.idea/
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace

# Environment variables
.env

# Security sensitive
/sa-key.json

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# misc
.DS_Store
EOF

# --- 2. Populate Core Angular Files ---
echo "-> Populating core Angular configuration files..."

tee src/index.html > /dev/null <<'EOF'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>SOW-Forge</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <app-root></app-root>
</body>
</html>
EOF

tee src/styles.css > /dev/null <<'EOF'
/* Global Styles */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background-color: #f4f7f9;
  color: #333;
}
.card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem 2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  border: 1px solid #e9ecef;
}
.error {
  color: #dc3545;
  font-weight: 500;
}
hr {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 2rem 0;
}
button, .btn, .action-link {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
EOF

tee src/app/app.config.ts > /dev/null <<'EOF'
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideMarkdown } from 'ngx-markdown';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideMarkdown()
  ]
};
EOF

tee src/app/app.component.css > /dev/null <<'EOF'
.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 2rem;
}
.app-header {
  text-align: left;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e9ecef;
  margin-bottom: 1.5rem;
}
.app-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0;
  color: #212529;
}
.app-header p {
  font-size: 1.1rem;
  color: #6c757d;
  margin: 0.25rem 0 0 0;
}
.app-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 2rem;
}
.app-tabs a {
  padding: 0.75rem 1.5rem;
  text-decoration: none;
  color: #495057;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.app-tabs a:hover {
  background-color: #f8f9fa;
  color: #0056b3;
}
.app-tabs a.active-tab {
  background-color: #e9f5ff;
  color: #007bff;
  font-weight: 600;
}
.app-content {
  background-color: #ffffff;
  border-radius: 8px;
}
EOF

# --- 3. Populate All CSS Files ---
echo "-> Populating all component and page CSS files..."

# Upload Component CSS
tee src/app/components/upload/upload.component.css > /dev/null <<'EOF'
:host {
  display: flex;
  justify-content: center;
  padding: 2rem;
}
.creator-card {
  width: 100%;
  max-width: 700px;
  padding: 2rem 2.5rem;
  text-align: center;
}
.card-header h2 { font-size: 1.75rem; margin-top: 0; color: #333; }
.card-header p { color: #666; margin-bottom: 2rem; }
.drop-zone { border: 2px dashed #d1d5db; border-radius: 8px; padding: 3rem 1rem; cursor: pointer; transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out; }
.drop-zone:hover, .drop-zone.is-dragging-over { background-color: #f0f7ff; border-color: #007bff; }
.drop-zone-prompt .icon { width: 48px; height: 48px; color: #007bff; margin: 0 auto 1rem; }
.drop-zone-prompt p { margin: 0; color: #555; }
.browse-text { font-size: 0.9rem; color: #007bff; }
.file-info-container { margin-top: 1.5rem; }
.file-details { display: flex; align-items: center; justify-content: center; background-color: #e9f5ff; border: 1px solid #bde0ff; padding: 0.75rem; border-radius: 6px; font-size: 1rem; }
.file-details .icon { width: 24px; height: 24px; margin-right: 0.75rem; color: #0056b3; }
.remove-file-btn { background: none; border: none; font-size: 1.5rem; line-height: 1; margin-left: auto; cursor: pointer; color: #666; }
.remove-file-btn:hover { color: #333; }
.action-btn { width: 100%; padding: 0.8rem 1rem; font-size: 1.1rem; font-weight: bold; color: white; background-color: #28a745; border: none; border-radius: 6px; cursor: pointer; margin-top: 1.5rem; transition: background-color 0.2s ease; }
.action-btn:hover { background-color: #218838; }
.action-btn:disabled { background-color: #ccc; cursor: not-allowed; }
.progress-container { margin-top: 1.5rem; }
.progress-bar { width: 100%; height: 8px; background-color: #e9ecef; border-radius: 4px; overflow: hidden; }
.progress { height: 100%; background-color: #007bff; width: 0%; transition: width 0.4s ease; border-radius: 4px; }
.status-message { margin-top: 0.5rem; font-size: 0.9rem; color: #666; }
EOF

# Dashboard/History CSS
tee src/app/pages/dashboard/dashboard.component.css > /dev/null <<'EOF'
.dashboard-container table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; font-size: 0.95rem; }
.dashboard-table th, .dashboard-table td { border: 1px solid #dee2e6; padding: 12px 15px; text-align: left; vertical-align: middle; }
.dashboard-table th { background-color: #f8f9fa; font-weight: 600; }
.dashboard-table tbody tr:hover { background-color: #f1f3f5; }
.status-badge { padding: 0.3em 0.7em; font-size: 75%; font-weight: 700; line-height: 1; text-align: center; white-space: nowrap; vertical-align: baseline; border-radius: 0.375rem; color: #fff; text-transform: uppercase; }
.status-badge.analyzed_success, .status-badge.sow_generated, .status-badge.sow_edited { background-color: #28a745; }
.status-badge.analysis_failed, .status-badge.ocr_failed { background-color: #dc3545; }
.status-badge.processing_ocr, .status-badge.analyzing, .status-badge.reanalysis_in_progress { background-color: #17a2b8; }
.display-name-form, .edit-name-form { display: flex; align-items: center; gap: 0.75rem; }
.edit-icon-btn { background: none; border: none; cursor: pointer; padding: 2px; opacity: 0.5; transition: opacity 0.2s ease; }
.edit-icon-btn:hover { opacity: 1; }
.edit-icon-btn svg { width: 16px; height: 16px; color: #007bff; }
.edit-name-form input { flex-grow: 1; padding: 6px 8px; font-size: 0.95rem; border: 1px solid #007bff; border-radius: 4px; }
.save-name-btn, .cancel-name-btn { padding: 6px 12px; border: 1px solid transparent; border-radius: 4px; cursor: pointer; font-size: 0.9rem; }
.save-name-btn { background-color: #28a745; color: white; }
.cancel-name-btn { background-color: #6c757d; color: white; }
.actions-cell { display: flex; gap: 0.75rem; }
.action-link { padding: 6px 12px; text-decoration: none; font-weight: 500; border-radius: 5px; }
.action-link.view-btn { background-color: #6c757d; color: white; }
.action-link.edit-sow { background-color: #007bff; color: white; }
EOF

# SOW and Template Editor CSS (they share styles)
EDITOR_CSS=$(cat <<'EOF'
.editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #e0e0e0; }
.editor-header h2 { margin: 0; font-size: 1.5rem; }
.actions .save-button { background-color: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
.actions .gdocs-button { background-color: #4285F4; color: white; margin-left: 10px; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
.actions button:disabled { background-color: #ccc; }
.save-status { margin-left: 1rem; font-style: italic; }
.tab-nav { margin-bottom: -1px; }
.tab-nav button { padding: 10px 20px; border: 1px solid #ccc; background-color: #f8f9fa; cursor: pointer; border-bottom: none; margin-right: 5px; border-radius: 4px 4px 0 0; }
.tab-nav button.active { background-color: white; border-bottom: 1px solid white; font-weight: bold; }
.tab-content { border: 1px solid #ccc; padding: 1rem; border-radius: 0 4px 4px 4px; }
.sow-editor { width: 100%; min-height: 600px; font-family: monospace; font-size: 14px; border: 1px solid #e0e0e0; padding: 10px; resize: vertical; }
.sow-preview { min-height: 600px; }
.back-button { display: inline-block; margin-bottom: 1.5rem; color: #007bff; text-decoration: none; }
.back-button:hover { text-decoration: underline; }
EOF
)
echo "$EDITOR_CSS" > src/app/pages/editor/editor.component.css
echo "$EDITOR_CSS" > src/app/pages/template-editor/template-editor.component.css

# Settings and Prompt Manager CSS (they share styles)
SETTINGS_CSS=$(cat <<'EOF'
.settings-container, .prompt-manager-container { max-width: 900px; margin: 0 auto; }
.settings-container h2, .prompt-manager-container h2 { font-size: 1.8rem; }
.settings-container p, .prompt-manager-container p { color: #666; margin-top: -10px; margin-bottom: 2rem; }
.setting-group { margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #f1f1f1; }
.setting-group:last-of-type { border-bottom: none; margin-bottom: 0; }
.setting-group h4 { font-size: 1.2rem; color: #0056b3; margin-top: 0; margin-bottom: 1.5rem; }
.form-field { display: flex; flex-direction: column; margin-bottom: 1rem; }
.form-field label { font-weight: 500; margin-bottom: 0.5rem; }
.form-field input, .form-field select, .form-field textarea { width: 100%; padding: 0.6rem 0.75rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
.form-field small { font-size: 0.8rem; color: #6c757d; margin-top: 0.5rem; }
.prompt-editor { min-height: 400px; font-family: monospace; line-height: 1.6; }
.actions { margin-top: 2rem; display: flex; align-items: center; gap: 1rem; }
.actions button { padding: 0.75rem 1.5rem; font-size: 1rem; font-weight: bold; color: white; background-color: #007bff; border: none; border-radius: 6px; cursor: pointer; }
.actions button:disabled { background-color: #ccc; }
.status-message { font-style: italic; color: #28a745; }
EOF
)
echo "$SETTINGS_CSS" > src/app/pages/settings/settings.component.css
echo "$SETTINGS_CSS" > src/app/pages/prompt-manager/prompt-manager.component.css

# All other HTML and CSS files can be left empty
touch src/app/pages/results/results.component.html
touch src/app/pages/results/results.component.css
touch src/app/pages/editor/editor.component.html
touch src/app/pages/template-editor/template-editor.component.html
touch src/app/pages/template-manager/template-manager.component.html
touch src/app/pages/prompt-manager/prompt-manager.component.html
touch src/app/pages/settings/settings.component.html

echo
echo "--------------------------------------------------------"
echo " SUCCESS: Frontend partial setup complete."
echo "--------------------------------------------------------"
echo
echo "--- NEXT STEPS ---"
echo "1. Manually populate the empty .ts files and server.js with their final code."
echo "2. Run 'npm install'."
echo "3. Create your 'sa-key.json' file."
echo "4. Run 'ng serve' and 'node server.js'."
echo