# --- Function #1: Document Pre-processing (Main Pipeline) ---
resource "google_cloudfunctions2_function" "doc_preprocess_trigger" {
  project  = var.gcp_project_id
  name     = "doc-preprocess-trigger"
  location = var.gcp_region

  build_config {
    runtime     = "python310"
    entry_point = "process_pdf"
    source {
      storage_source {
        bucket = google_storage_bucket.app_buckets["functions_source"].name
        object = "doc_preprocess_trigger.zip"
      }
    }
  }

  service_config {
    max_instance_count    = 3
    available_memory      = "1Gi"
    timeout_seconds       = 540
    service_account_email = google_service_account.master_sa.email
    environment_variables = {
      GCP_PROJECT_NUMBER = var.gcp_project_id # Pass project ID, not number
      DOCAI_PROCESSOR_ID = var.docai_processor_id
      DOCAI_LOCATION     = var.docai_processor_location
    }
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

# --- All other function definitions would follow the same pattern ---
# For example, the legislative_analysis_func:

resource "google_cloudfunctions2_function" "legislative_analysis_func" {
  project  = var.gcp_project_id
  name     = "legislative-analysis-func"
  location = var.gcp_region

  build_config {
    runtime     = "python310"
    entry_point = "analyze_text"
    source {
      storage_source {
        bucket = google_storage_bucket.app_buckets["functions_source"].name
        object = "legislative_analysis_func.zip" 
      }
    }
  }

  service_config {
    max_instance_count    = 5
    available_memory      = "1Gi" 
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

# ... and so on for the other 4 functions ...