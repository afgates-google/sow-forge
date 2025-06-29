#!/bin/bash
#
# This script taints all Cloud Function resources to force a full
# destroy-and-recreate on the next 'terraform apply'.
#
# USAGE: Run from the 'infrastructure' directory.
# > chmod +x taint_all_functions.sh
# > ./taint_all_functions.sh

set -e

echo "--- Tainting All SOW-Forge Cloud Functions ---"
echo

# An array of the Terraform resource names for our functions
FUNCTIONS_TO_TAINT=(
    "google_cloudfunctions2_function.doc_preprocess_trigger"
    "google_cloudfunctions2_function.legislative_analysis_func"
    "google_cloudfunctions2_function.batch_result_handler"
    "google_cloudfunctions2_function.sow_generation_func"
    "google_cloudfunctions2_function.template_generation_func"
    "google_cloudfunctions2_function.create_google_doc"
)

for resource_name in "${FUNCTIONS_TO_TAINT[@]}"; do
    echo " > Tainting resource: $resource_name"
    terraform taint "$resource_name"
done

echo
echo "------------------------------------------------"
echo "✔ All 6 functions have been marked for recreation."
echo "------------------------------------------------"