#!/bin/bash

# SOW-Forge Remaining CSS Population Script
#
# This script populates the final CSS files for the application.
# It assumes the file and directory skeleton has already been created.
#
# USAGE: Run this script from the root of the 'sow-forge' project.
# > chmod +x populate_remaining_css.sh
# > ./populate_remaining_css.sh

set -e

echo " SOW-FORGE REMAINING CSS POPULATION "
echo "===================================="
echo

# Navigate to the frontend directory
if [ ! -d "frontend" ]; then
    echo "ERROR: 'frontend' directory not found. Please run this script from the 'sow-forge' root."
    exit 1
fi
cd frontend

# --- 1. Populate Template Manager CSS ---
echo "-> Populating template-manager.component.css..."

tee src/app/pages/template-manager/template-manager.css > /dev/null <<'EOF'
.manager-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
.card h3 {
  margin-top: 0;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.75rem;
  margin-bottom: 1.5rem;
}
.form-group {
  margin-bottom: 1rem;
  text-align: left;
}
.form-group label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
}
.form-group input[type="text"],
.form-group textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
}
.browse-button {
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  padding: 0.5rem 1rem;
  cursor: pointer;
  border-radius: 4px;
}
.file-list {
  text-align: left;
  margin-top: 1rem;
  font-size: 0.9rem;
  background-color: #f8f9fa;
  padding: 0.5rem 1rem;
  border-radius: 4px;
}
.file-list ul {
  margin: 0.5rem 0 0 0;
  padding-left: 1rem;
}
.action-btn {
  width: 100%;
  padding: 0.8rem 1rem;
  font-size: 1.1rem;
  font-weight: bold;
  color: white;
  background-color: #007bff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 1.5rem;
}
.action-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}
.status-message {
  margin-top: 1rem;
  font-style: italic;
  color: #333;
}
.existing-templates-card ul {
  list-style-type: none;
  padding: 0;
}
.existing-templates-card li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}
.existing-templates-card li:last-child {
  border-bottom: none;
}
.template-info span {
  display: block;
  font-size: 0.9em;
  color: #6c757d;
  margin-top: 0.25rem;
}
.template-actions {
  display: flex;
  gap: 0.5rem;
}
.edit-btn, .delete-btn {
  text-decoration: none;
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid transparent;
}
.edit-btn {
  background-color: #e9ecef;
  color: #212529;
  border-color: #dee2e6;
}
.delete-btn {
  background-color: #f8d7da;
  color: #721c24;
  border-color: #f5c6cb;
}
EOF

# --- 2. Populate Results Page CSS ---
echo "-> Populating results.component.css..."

tee src/app/pages/results/results.component.css > /dev/null <<'EOF'
.results-container { padding: 1rem; }
.results-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}
.results-header h2 {
  margin: 0;
  flex-grow: 1;
}
.status-message { font-style: italic; color: #333; width: 100%; text-align: right; }
.summary-section {
  background-color: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  border: 1px solid #e9ecef;
}
.summary-section h3 { margin-top: 0; }
.requirements-section table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}
.requirements-section th, .requirements-section td {
  border: 1px solid #ddd;
  padding: 10px 12px;
  text-align: left;
}
.requirements-section th {
  background-color: #e9ecef;
  font-weight: 600;
}
.template-selection {
  margin-top: 2rem;
  border-top: 1px solid #eee;
  padding-top: 1.5rem;
}
.template-selection ul {
  list-style-type: none;
  padding: 0;
}
.template-selection li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}
.template-selection li:hover {
  background-color: #f8f9fa;
}
.error-message { color: red; }

.btn, .btn-primary, .btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  font-size: 1rem;
  font-weight: 500;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}
.btn:disabled { opacity: 0.65; cursor: not-allowed; }
.btn svg { width: 1.25em; height: 1.25em; }
.btn-primary { background-color: #007bff; color: white; border-color: #007bff; }
.btn-primary:hover:not(:disabled) { background-color: #0056b3; }
.btn-secondary { background-color: #6c757d; color: white; border-color: #6c757d; }
.btn-secondary:hover:not(:disabled) { background-color: #5a6268; }

.spinner {
  width: 1em; height: 1em;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s ease-in-out infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
EOF

echo
echo "--------------------------------------------------------"
echo " SUCCESS: Remaining CSS files populated."
echo "--------------------------------------------------------"
echo "-> Your frontend source code is now 100% complete."
echo