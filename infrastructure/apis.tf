resource "google_project_service" "enabled_apis" {
  for_each = toset([
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "storage.googleapis.com",
    "firestore.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "documentai.googleapis.com",
    "aiplatform.googleapis.com",
    "eventarc.googleapis.com",
    "artifactregistry.googleapis.com",
    "logging.googleapis.com",
    "pubsub.googleapis.com",
    "docs.googleapis.com"
  ])

  project                    = var.gcp_project_id
  service                    = each.key
  disable_on_destroy         = false
  disable_dependent_services = true
}