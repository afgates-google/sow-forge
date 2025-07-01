# Defines the Cloud Run service for our main Node.js backend server.
resource "google_cloud_run_v2_service" "backend_server" {
  project  = var.gcp_project_id
  name     = "sow-forge-backend-server"
  location = var.gcp_region

  # By default, the service is internal-only. We temporarily allow all
  # traffic for development, but this should be locked down later.
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.master_sa.email

    scaling {
      min_instance_count = 1 # Keep at least one instance warm
      max_instance_count = 5
    }

    containers {
      # --- THIS IS THE CRITICAL FIX ---
      # It now correctly references the local variables 'local. ...'
      image = "us-central1-docker.pkg.dev/${var.gcp_project_id}/${local.artifact_registry_repo_id}/${local.backend_server_image_name}:${var.deployment_suffix}"
      
      ports {
        container_port = 8080
      }
    }
  }

  depends_on = [
    google_artifact_registry_repository.main_repo
  ]
}