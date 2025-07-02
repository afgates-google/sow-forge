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

# Grant the hardened, least-privilege roles to our custom master service account
resource "google_project_iam_member" "master_sa_roles" {
  for_each = toset([
    # Required for Firestore (read/write documents)
    "roles/datastore.user",
    # Required for calling Vertex AI models
    "roles/aiplatform.user",
    # Required for calling the Document AI API
    "roles/documentai.apiUser",
    # Required for invoking other Cloud Functions/Run services
    "roles/run.invoker",
    # Required for Eventarc to invoke this service account
    "roles/eventarc.eventReceiver",
    # Required to publish to Pub/Sub for re-analysis trigger
    "roles/pubsub.publisher",
    # Required for the backend server to create ID tokens for other services
    "roles/iam.serviceAccountTokenCreator"
  ])
  project = var.gcp_project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.master_sa.email}"
}

# Instead of project-wide storage admin, grant specific object permissions on each bucket
resource "google_storage_bucket_iam_member" "master_sa_bucket_access" {
  for_each = toset([
    google_storage_bucket.app_buckets["uploads"].name,
    google_storage_bucket.app_buckets["processed_text"].name,
    google_storage_bucket.app_buckets["batch_output"].name,
    google_storage_bucket.app_buckets["templates"].name,
    google_storage_bucket.app_buckets["template_samples"].name
  ])
  bucket = each.key
  # This role allows creating, reading, and deleting OBJECTS, but not the bucket itself.
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.master_sa.email}"
}

# Grant the Document AI Service Agent permission to WRITE results to the batch bucket
resource "google_storage_bucket_iam_member" "docai_agent_can_write_to_batch_bucket" {
  bucket = google_storage_bucket.app_buckets["batch_output"].name
  # CHANGED: This only needs to create objects, not be a full admin.
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-prod-dai-core.iam.gserviceaccount.com"
}

# Grant the GCS Service Account permission to publish to Pub/Sub for Eventarc triggers
resource "google_project_iam_member" "gcs_sa_pubsub_publisher" {
  project = var.gcp_project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"
}

# Grant permissions to the default Cloud Build service account (NO CHANGES NEEDED HERE)
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
# Grant the Cloud Build service account permission to write to our new Artifact Registry repository.
resource "google_artifact_registry_repository_iam_member" "build_service_can_write_to_repo" {
  project    = google_artifact_registry_repository.main_repo.project
  location   = google_artifact_registry_repository.main_repo.location
  repository = google_artifact_registry_repository.main_repo.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
}
# Grant the default Compute Engine SA the ability to act as the Cloud Build service agent.
# This is required for it to be able to upload source code for builds.
resource "google_project_iam_member" "compute_sa_can_run_builds" {
  project = var.gcp_project_id
  role    = "roles/cloudbuild.serviceAgent"
  member  = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}