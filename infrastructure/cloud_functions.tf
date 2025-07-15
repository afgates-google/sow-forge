# ------------------------------------------------------------------
# Function #1: Document Pre-processing
# ------------------------------------------------------------------
resource "google_cloudfunctions2_function" "doc_preprocess_trigger" {
  project  = var.gcp_project_id
  name     = "doc-preprocess-trigger"
  location = var.gcp_region

  build_config {
    runtime     = "python312"
    entry_point = "doc_preprocess_trigger"
    source {
      storage_source {
        bucket = google_storage_bucket.app_buckets["functions_source"].name
        object = "doc-preprocess-trigger.zip"
      }
    }
  }

  service_config {
    max_instance_count    = 3
    available_memory      = "512Mi"
    timeout_seconds       = 540
    service_account_email = google_service_account.master_sa.email
  }

  event_trigger {
    trigger_region        = var.gcs_location
    event_type            = "google.cloud.storage.object.v1.finalized"
    retry_policy          = "RETRY_POLICY_RETRY"
    service_account_email = google_service_account.master_sa.email
    event_filters {
      attribute = "bucket"
      value     = google_storage_bucket.app_buckets["uploads"].name
    }
  }
}

# ------------------------------------------------------------------
# Function #2: Dynamic Text Analysis
# ------------------------------------------------------------------
resource "google_cloudfunctions2_function" "legislative_analysis_func" {
  project  = var.gcp_project_id
  name     = "legislative-analysis-func"
  location = var.gcp_region

  build_config {
    runtime     = "python312"
    entry_point = "legislative_analysis_func"
    source {
      storage_source {
        bucket = google_storage_bucket.app_buckets["functions_source"].name
        object = "legislative-analysis-func.zip"
      }
    }
  }

  service_config {
    max_instance_count    = 5
    available_memory      = "512Mi"
    timeout_seconds       = 540
    service_account_email = google_service_account.master_sa.email
  }

  event_trigger {
    trigger_region        = var.gcs_location
    event_type            = "google.cloud.storage.object.v1.finalized"
    retry_policy          = "RETRY_POLICY_RETRY"
    service_account_email = google_service_account.master_sa.email
    event_filters {
      attribute = "bucket"
      value     = google_storage_bucket.app_buckets["processed_text"].name
    }
  }
}

# ------------------------------------------------------------------
# Function #3: Batch Result Handler
# ------------------------------------------------------------------
resource "google_cloudfunctions2_function" "batch_result_handler" {
  project  = var.gcp_project_id
  name     = "batch-result-handler"
  location = var.gcp_region

  build_config {
    runtime     = "python312"
    entry_point = "batch_result_handler"
    source {
      storage_source {
        bucket = google_storage_bucket.app_buckets["functions_source"].name
        object = "batch-result-handler.zip"
      }
    }
  }

  service_config {
    max_instance_count    = 2
    timeout_seconds       = 300
    service_account_email = google_service_account.master_sa.email
  }

  event_trigger {
    trigger_region        = var.gcs_location
    event_type            = "google.cloud.storage.object.v1.finalized"
    retry_policy          = "RETRY_POLICY_RETRY"
    service_account_email = google_service_account.master_sa.email
    event_filters {
      attribute = "bucket"
      value     = google_storage_bucket.app_buckets["batch_output"].name
    }
  }
}

# ------------------------------------------------------------------
# Function #4: SOW Generation (HTTP Trigger)
# ------------------------------------------------------------------
resource "google_cloudfunctions2_function" "sow_generation_func" {
  project  = var.gcp_project_id
  name     = "sow-generation-func"
  location = var.gcp_region

  build_config {
    runtime     = "python312"
    entry_point = "sow_generation_func"
    source {
      storage_source {
        bucket = google_storage_bucket.app_buckets["functions_source"].name
        object = "sow-generation-func.zip"
      }
    }
  }

  service_config {
    max_instance_count             = 3
    available_memory               = "512Mi"
    timeout_seconds                = 540
    all_traffic_on_latest_revision = true
    service_account_email          = google_service_account.master_sa.email
    ingress_settings               = "ALLOW_INTERNAL_ONLY"
  }
}

# ------------------------------------------------------------------
# Function #5: Template Generation (HTTP Trigger)
# ------------------------------------------------------------------
resource "google_cloudfunctions2_function" "template_generation_func" {
  project  = var.gcp_project_id
  name     = "template-generation-func"
  location = var.gcp_region

  build_config {
    runtime     = "python312"
    entry_point = "template_generation_func"
    source {
      storage_source {
        bucket = google_storage_bucket.app_buckets["functions_source"].name
        object = "template-generation-func.zip"
      }
    }
  }

  service_config {
    max_instance_count             = 2
    timeout_seconds                = 540
    available_memory               = "512Mi"
    all_traffic_on_latest_revision = true
    service_account_email          = google_service_account.master_sa.email
    ingress_settings               = "ALLOW_INTERNAL_ONLY"
  }
}

# ------------------------------------------------------------------
# Function #6: Create Google Doc (HTTP Trigger)
# ------------------------------------------------------------------
resource "google_cloudfunctions2_function" "create_google_doc" {
  project  = var.gcp_project_id
  name     = "create-google-doc"
  location = var.gcp_region

  build_config {
    runtime     = "python312"
    entry_point = "create_google_doc"
    source {
      storage_source {
        bucket = google_storage_bucket.app_buckets["functions_source"].name
        object = "create-google-doc.zip"
      }
    }
  }

  service_config {
    max_instance_count             = 2
    timeout_seconds                = 120
    all_traffic_on_latest_revision = true
    service_account_email          = google_service_account.master_sa.email
    ingress_settings               = "ALLOW_INTERNAL_ONLY"
  }
}

# --- Terraform Outputs ---
# These outputs make the function URLs available to the deployment script.
output "sow_generation_func_url" {
  description = "The URL of the SOW generation function."
  value       = google_cloudfunctions2_function.sow_generation_func.service_config[0].uri
}

output "template_generation_func_url" {
  description = "The URL of the template generation function."
  value       = google_cloudfunctions2_function.template_generation_func.service_config[0].uri
}

output "create_google_doc_func_url" {
  description = "The URL of the create google doc function."
  value       = google_cloudfunctions2_function.create_google_doc.service_config[0].uri
}