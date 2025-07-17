#!/bin/bash
#
# SOW-Forge Test Script: SOW Generation (v2 - with setup/teardown)
#
# This script directly invokes the sow-generation-func, creating a temporary
# Firestore document to ensure the test is valid and self-contained.
#
# USAGE:
# 1. Make the script executable: chmod +x test_sow_generation.sh
# 2. Run the script with a template ID:
#    ./test_sow_generation.sh YOUR_TEMPLATE_ID
#
#    Example: ./test_sow_generation.sh sow_template_v1

set -e

# --- Configuration ---
TEMPLATE_ID_ARG=$1
GCP_PROJECT_ID=$(gcloud config get-value project)

if [ -z "$TEMPLATE_ID_ARG" ]; then
    echo "Usage: $0 <TEMPLATE_ID>"
    echo "Example: $0 sow_template_v1"
    exit 1
fi

# --- Setup: Create a temporary project document ---
echo "--- SETUP: Creating temporary project in Firestore ---"
# Create a temporary virtual environment to avoid system conflicts
python3 -m venv temp_venv_test
# Activate the virtual environment
source temp_venv_test/bin/activate
# Ensure python dependencies are available
pip install -r functions/sow-generation-func/requirements.txt -q
NEW_PROJECT_ID=$(python3 create_test_project.py)
if [ -z "$NEW_PROJECT_ID" ]; then
    echo "!!! ERROR: Failed to create test project document. Exiting. !!!"
    deactivate
    rm -rf temp_venv_test
    exit 1
fi
echo "  -> Created test project with ID: $NEW_PROJECT_ID"


# --- Test Execution ---
echo
echo "--- TEST: Directly invoking SOW Generation function ---"
echo "======================================================="

# 1. Get the URL of the function from Terraform output
echo " > Getting function URL from Terraform..."
cd infrastructure
FUNCTION_URL=$(terraform output -raw sow_generation_func_url)
cd ..
echo "   - Function URL: $FUNCTION_URL"

# 2. Get an identity token for authentication
echo " > Generating identity token..."
AUTH_TOKEN=$(gcloud auth print-identity-token)
echo "   - Token generated."

# 3. Construct the JSON payload
JSON_PAYLOAD=$(cat <<EOF
{
  "projectId": "$NEW_PROJECT_ID",
  "templateId": "$TEMPLATE_ID_ARG"
}
EOF
)
echo " > Sending payload: $JSON_PAYLOAD"

# 4. Invoke the function with curl
echo " > Invoking function via curl..."
curl -m 70 -X POST "$FUNCTION_URL" \
  -H "Authorization: bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD"

echo
echo "======================================================="
echo " SUCCESS! Test invocation complete. "
echo "======================================================="


# --- Teardown: Clean up the temporary project ---
echo
echo "--- TEARDOWN: Deleting temporary project from Firestore ---"
source temp_venv_test/bin/activate
python3 delete_test_project.py "$NEW_PROJECT_ID"
deactivate
rm -rf temp_venv_test
echo "  -> Cleanup complete."

