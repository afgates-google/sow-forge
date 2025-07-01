# Defines local values for consistency and reusability across the configuration.
locals {
  # The ID of the Artifact Registry repository.
  artifact_registry_repo_id = "sow-forge-repo"

  # The name of the Docker image for the backend server.
  backend_server_image_name = "sow-forge-backend-server"
}