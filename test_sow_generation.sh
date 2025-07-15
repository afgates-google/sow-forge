#!/bin/bash
#
# SOW-Forge Test Script: SOW Generation
#
# This script directly invokes the sow-generation-func, bypassing the frontend
# and backend server, to test it in isolation.
#
# USAGE:
# 1. Make the script executable: chmod +x test_sow_generation.sh
# 2. Run the script with a project ID and template ID:
#    ./test_sow_generation.sh YOUR_PROJECT_ID YOUR_TEMPLATE_ID
#
#    Example: ./test_sow_generation.sh kHrqL0OWpJQwDxoyiEhq sow_template_v1

set -e

# --- Configuration ---
PROJECT_ID_ARG=$1
TEMPLATE_ID_ARG=$2

if [ -z "$PROJECT_ID_ARG" ] || [ -z "$TEMPLATE_ID_ARG" ]; then
    echo "Usage: $0 <PROJECT_ID> <TEMPLATE_ID>"
    echo "Example: $0 kHrqL0OWpJQwDxoyiEhq sow_template_v1"
    exit 1
fi

echo "--- TEST: DIRECTLY INVOKE SOW GENERATION FUNCTION ---"
echo "====================================================="

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
  "projectId": "$PROJECT_ID_ARG",
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
echo "====================================================="
echo " SUCCESS! Test invocation complete. "
echo "====================================================="
