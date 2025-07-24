
# resource "google_compute_global_address" "lb_ip" {
#   name = "sow-forge-lb-ip"
# }

# resource "google_compute_managed_ssl_certificate" "lb_ssl" {
#   name = "sow-forge-lb-ssl"
#   managed {
#     domains = ["${var.domain}"]
#   }
# }

# resource "google_compute_target_https_proxy" "lb_proxy" {
#   name             = "sow-forge-lb-proxy"
#   url_map          = google_compute_url_map.lb_url_map.id
#   ssl_certificates = [google_compute_managed_ssl_certificate.lb_ssl.id]
# }

# resource "google_compute_url_map" "lb_url_map" {
#   name            = "sow-forge-lb-url-map"
#   default_service = google_compute_backend_bucket.frontend_backend_bucket.id

#   host_rule {
#     hosts        = ["*"]
#     path_matcher = "all-paths"
#   }

#   path_matcher {
#     name            = "all-paths"
#     default_service = google_compute_backend_bucket.frontend_backend_bucket.id

#     path_rule {
#       paths   = ["/api/*"]
#       service = google_compute_backend_service.backend_service.id
#     }
#   }
# }

# resource "google_compute_global_forwarding_rule" "lb_forwarding_rule" {
#   name       = "sow-forge-lb-forwarding-rule"
#   target     = google_compute_target_https_proxy.lb_proxy.id
#   ip_address = google_compute_global_address.lb_ip.address
#   port_range = "443"
# }

# resource "google_compute_health_check" "backend_health_check" {
#   name                = "sow-forge-backend-health-check"
#   check_interval_sec  = 10
#   timeout_sec         = 5
#   healthy_threshold   = 2
#   unhealthy_threshold = 2

#   http_health_check {
#     request_path = "/"
#     port         = "8080"
#   }
# }
