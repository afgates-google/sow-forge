echo "Starting Terraform import process for project: ${PROJECT_ID}"
echo "-------------------------------------------------------------------"

# 2. Import Google Cloud Storage Buckets
# The image provided the exact bucket names.
declare -A buckets=(
    ["template_samples"]="sow-forge-texas-dmv-template-samples" # Corrected name from image
    ["processed_text"]="sow-forge-texas-dmv-processed-text"
    ["uploads"]="sow-forge-texas-dmv-uploads"
    ["batch_output"]="sow-forge-texas-dmv-batch-output"
    ["functions_source"]="sow-forge-texas-dmv-functions-source"
    ["templates"]="sow-forge-texas-dmv-templates"
)

for key in "${!buckets[@]}"; do
    bucket_name="${buckets[$key]}"
    echo "Importing GCS bucket: ${bucket_name} (resource key: ${key})..."
    terraform import "google_storage_bucket.app_buckets[\"${key}\"]" "${bucket_name}"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to import GCS bucket '${bucket_name}'. Please ensure the bucket exists and the name is correct."
        exit 1
    fi
    echo "GCS bucket '${bucket_name}' imported successfully."
done


echo "All specified resources have been targeted for import."
echo "Running 'terraform plan' to verify the state..."
echo "-------------------------------------------------------------------"
terraform plan
