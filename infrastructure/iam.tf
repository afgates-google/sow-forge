# --- DATA SOURCES to look up Google-managed accounts ---
data "google_storage_project_service_account" "gcs_account" {
  project = var.gcp_project_id
}

data "google_project" "project" {
  project_id = var.gcp_project_id
}


# --- CUSTOM SERVICE ACCOUNT ---
resource "google_service_account" "master_sa" {
  account_id   = var.master_service_account_id
  display_name = "SOW-Forge Master Service Account"
  project      = var.gcp_project_id
}


# --- IAM BINDINGS ---

# Grant roles to our custom master service account
resource "google_project_iam_member" "master_sa_roles" {
  for_each = toset([
    "roles/documentai.viewer",
    "roles/storage.admin",
    "roles/datastore.user",
    "roles/aiplatform.user",
    "roles/cloudbuild.builds.builder",
    "roles/iam.serviceAccountUser",
    "roles/eventarc.eventReceiver",
    "roles/run.invoker",
    "roles/cloudfunctions.invoker"
  ])
  project = var.gcp_project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.master_sa.email}"
}

# Grant permissions to the default Cloud Build service account
resource "google_project_iam_member" "cloudbuild_sa_permissions" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/storage.objectViewer",
    "roles/artifactregistry.writer"
  ])
  project = var.gcp_project_id
  role    = each.key
  member  = "serviceAccount:${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
}

# Grant the Document AI Service Agent permission to WRITE results to the batch bucket
resource "google_storage_bucket_iam_member" "docai_agent_can_write_to_batch_bucket" {
  bucket = google_storage_bucket.app_buckets["batch_output"].name
  role   = "roles/storage.admin"
  member = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-prod-dai-core.iam.gserviceaccount.com"
}

# Grant the GCS Service Account permission to publish to Pub/Sub for triggers
resource "google_project_iam_member" "gcs_sa_pubsub_publisher" {
  project = var.gcp_project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"
}