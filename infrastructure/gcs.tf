# In infrastructure/gcs.tf

# TODO (Production Deployment): Before the final production deployment,
# add a 'cors' configuration block to this resource. The 'origin'
# will be the final, public-facing URL of the deployed Angular frontend.
# Example:
#
# cors {
#   origin          = ["https://sow-forge.your-company.com"]
#   method          = ["PUT", "OPTIONS"]
#   response_header = ["Content-Type", "Access-Control-Allow-Origin"]
#   max_age_seconds = 3600
# }
#

resource "google_storage_bucket" "app_buckets" {
  for_each = var.bucket_names

  project                     = var.gcp_project_id
  name                        = "${var.bucket_prefix}-${each.value}"
  location                    = var.gcs_location
  force_destroy               = true
  uniform_bucket_level_access = true

  dynamic "cors" {
    for_each = each.key == "uploads" ? [1] : []
    content {
      origin          = ["https://4200-w-admin-mc9if4o2.cluster-e3ppspjf3zfnqwaa5t6uqxhwjo.cloudworkstations.dev", "http://localhost:4200"]
      method          = ["PUT", "OPTIONS"]
      response_header = ["Content-Type", "Access-Control-Allow-Origin"]
      max_age_seconds = 3600
    }
  }

  depends_on = [google_project_service.enabled_apis]
}