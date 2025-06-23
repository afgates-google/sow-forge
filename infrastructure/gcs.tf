resource "google_storage_bucket" "app_buckets" {
  for_each = var.bucket_names

  project                     = var.gcp_project_id
  name                        = "${var.bucket_prefix}-${each.value}"
  location                    = var.gcs_location
  force_destroy               = true
  uniform_bucket_level_access = true

  depends_on = [google_project_service.enabled_apis]
}