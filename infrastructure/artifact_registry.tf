# In infrastructure/artifact_registry.tf
resource "google_artifact_registry_repository" "main_repo" {
  project       = var.gcp_project_id
  location      = var.gcp_region
  # Use the local value
  repository_id = local.artifact_registry_repo_id 
  description   = "Docker repository for SOW-Forge application images"
  format        = "DOCKER"
}