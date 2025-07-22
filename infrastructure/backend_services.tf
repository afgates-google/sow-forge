
resource "google_compute_backend_bucket" "frontend_backend_bucket" {
  name        = "sow-forge-frontend-backend-bucket"
  bucket_name = "sow-forge-frontend-hosting-${var.gcp_project_id}"
  enable_cdn  = true
}

resource "google_compute_region_network_endpoint_group" "backend_neg" {
  name                  = "sow-forge-backend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.gcp_region
  cloud_run {
    service = google_cloud_run_v2_service.backend_server.name
  }
}

resource "google_compute_backend_service" "backend_service" {
  name                  = "sow-forge-backend-service"
  protocol              = "HTTP"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  

  backend {
    group = google_compute_region_network_endpoint_group.backend_neg.id
  }
}
