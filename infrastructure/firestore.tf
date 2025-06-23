resource "google_firestore_database" "database" {
  project     = var.gcp_project_id
  name        = "(default)"
  location_id = var.firestore_location # Use variable
  type        = "FIRESTORE_NATIVE"
  depends_on  = [google_project_service.enabled_apis]
}