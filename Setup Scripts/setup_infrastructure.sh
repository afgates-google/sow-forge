#!/bin/bash

# This script creates the complete Terraform configuration for the SOW-Forge backend.
# It generates all necessary .tf files with their final, correct code.
#
# USAGE:
# 1. Save this file as 'setup_infrastructure.sh'.
# 2. Make it executable: chmod +x setup_infrastructure.sh
# 3. Run it from an empty directory or your home directory: ./setup_infrastructure.sh
# It will create a 'sow-forge/infrastructure' directory with all the files.

# Exit immediately if a command exits with a non-zero status.
set -e

echo " SOW-FORGE INFRASTRUCTURE SETUP "
echo "==================================="
echo

# --- Create Directory Structure ---
echo "-> Creating directory: sow-forge/infrastructure"
mkdir -p sow-forge/infrastructure
cd sow-forge/infrastructure

# --- Create variables.tf ---
echo "-> Creating variables.tf"
tee variables.tf <<'EOF'
variable "gcp_project_id" {
  description = "The GCP project ID."
  type        = string
  default     = "state-of-texas-sow-demo"
}

variable "gcp_region" {
  description = "The GCP region for primary resources."
  type        = string
  default     = "us-central1"
}

variable "gcp_project_number" {
  description = "The GCP project NUMBER. Required for some IAM bindings."
  type        = string
  default     = "416020007520"
}

variable "docai_processor_id" {
  description = "The ID of the Document AI OCR Processor."
  type        = string
  default     = "d64449d9cff40bf1"
}
EOF

# --- Create main.tf ---
echo "-> Creating main.tf"
tee main.tf <<'EOF'
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}
EOF

# --- Create apis.tf ---
echo "-> Creating apis.tf"
tee apis.tf <<'EOF'
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
EOF

# --- Create gcs.tf ---
echo "-> Creating gcs.tf"
tee gcs.tf <<'EOF'
resource "google_storage_bucket" "uploads" {
  project                     = var.gcp_project_id
  name                        = "sow-forge-texas-dmv-uploads"
  location                    = "US"
  force_destroy               = true
  uniform_bucket_level_access = true
}

resource "google_storage_bucket" "processed_text" {
  project                     = var.gcp_project_id
  name                        = "sow-forge-texas-dmv-processed-text"
  location                    = "US"
  force_destroy               = true
  uniform_bucket_level_access = true
}

resource "google_storage_bucket" "functions_source" {
  project                     = var.gcp_project_id
  name                        = "sow-forge-texas-dmv-functions-source"
  location                    = "US"
  force_destroy               = true
  uniform_bucket_level_access = true
}

resource "google_storage_bucket" "template_samples" {
  project                     = var.gcp_project_id
  name                        = "sow-forge-texas-dmv-template-samples"
  location                    = "US"
  force_destroy               = true
  uniform_bucket_level_access = true
}

resource "google_storage_bucket" "templates" {
  project                     = var.gcp_project_id
  name                        = "sow-forge-texas-dmv-templates"
  location                    = "US"
  force_destroy               = true
  uniform_bucket_level_access = true
}

resource "google_storage_bucket" "batch_output" {
  project                     = var.gcp_project_id
  name                        = "sow-forge-texas-dmv-batch-output"
  location                    = "US"
  force_destroy               = true
  uniform_bucket_level_access = true
}
EOF

# --- Create firestore.tf ---
echo "-> Creating firestore.tf"
tee firestore.tf <<'EOF'
resource "google_firestore_database" "database" {
  project     = var.gcp_project_id
  name        = "(default)"
  location_id = "nam5"
  type        = "FIRESTORE_NATIVE"
  depends_on  = [google_project_service.enabled_apis]
}
EOF

# --- Create iam.tf ---
echo "-> Creating iam.tf"
tee iam.tf <<'EOF'
resource "google_service_account" "sow_forge_master_sa" {
  account_id   = "sow-forge-master-sa"
  display_name = "SOW-Forge Master Service Account"
  project      = var.gcp_project_id
}

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
  member  = "serviceAccount:${google_service_account.sow_forge_master_sa.email}"
}

resource "google_project_iam_member" "compute_sa_build_permissions" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/storage.objectViewer",
    "roles/artifactregistry.writer"
  ])
  project = var.gcp_project_id
  role    = each.key
  member  = "serviceAccount:${var.gcp_project_number}@cloudbuild.gserviceaccount.com"
}

resource "google_storage_bucket_iam_member" "docai_agent_can_write_to_batch_bucket" {
  bucket = google_storage_bucket.batch_output.name
  role   = "roles/storage.admin"
  member = "serviceAccount:service-${var.gcp_project_number}@gcp-sa-prod-dai-core.iam.gserviceaccount.com"
}

data "google_storage_project_service_account" "gcs_account" {
  project = var.gcp_project_id
}
resource "google_project_iam_member" "gcs_sa_pubsub_publisher" {
  project = var.gcp_project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"
}
EOF

# --- Create cloud_functions.tf ---
echo "-> Creating cloud_functions.tf"
tee cloud_functions.tf <<'EOF'
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
        bucket = google_storage_bucket.functions_source.name
        object = "doc_preprocess_trigger.zip"
      }
    }
  }

  service_config {
    max_instance_count    = 3
    available_memory      = "512Mi"
    timeout_seconds       = 540
    service_account_email = google_service_account.sow_forge_master_sa.email
    environment_variables = {
      GCP_PROJECT_NUMBER = var.gcp_project_number
      DOCAI_PROCESSOR_ID = var.docai_processor_id
      DOCAI_LOCATION     = "us"
    }
  }

  event_trigger {
    trigger_region        = "us"
    event_type            = "google.cloud.storage.object.v1.finalized"
    retry_policy          = "RETRY_POLICY_RETRY"
    service_account_email = google_service_account.sow_forge_master_sa.email
    event_filters {
      attribute = "bucket"
      value     = google_storage_bucket.uploads.name
    }
  }
}

# --- Function #2: Legislative Analysis (Main Pipeline) ---
resource "google_cloudfunctions2_function" "legislative_analysis_func" {
  project  = var.gcp_project_id
  name     = "legislative-analysis-func"
  location = var.gcp_region

  build_config {
    runtime     = "python310"
    entry_point = "analyze_text"
    source {
      storage_source {
        bucket = google_storage_bucket.functions_source.name
        object = "legislative_analysis_func.zip"
      }
    }
  }

  service_config {
    max_instance_count    = 5
    available_memory      = "512Mi"
    timeout_seconds       = 540
    service_account_email = google_service_account.sow_forge_master_sa.email
  }

  event_trigger {
    trigger_region        = "us"
    event_type            = "google.cloud.storage.object.v1.finalized"
    retry_policy          = "RETRY_POLICY_RETRY"
    service_account_email = google_service_account.sow_forge_master_sa.email
    event_filters {
      attribute = "bucket"
      value     = google_storage_bucket.processed_text.name
    }
  }
}

# --- Function #3: Batch Result Handler (Main Pipeline) ---
resource "google_cloudfunctions2_function" "batch_result_handler" {
  project  = var.gcp_project_id
  name     = "batch-result-handler"
  location = var.gcp_region

  build_config {
    runtime     = "python310"
    entry_point = "handle_batch_result"
    source {
      storage_source {
        bucket = google_storage_bucket.functions_source.name
        object = "batch_result_handler.zip"
      }
    }
  }

  service_config {
    max_instance_count    = 2
    timeout_seconds       = 300
    service_account_email = google_service_account.sow_forge_master_sa.email
  }

  event_trigger {
    trigger_region        = "us"
    event_type            = "google.cloud.storage.object.v1.finalized"
    retry_policy          = "RETRY_POLICY_RETRY"
    service_account_email = google_service_account.sow_forge_master_sa.email
    event_filters {
      attribute = "bucket"
      value     = google_storage_bucket.batch_output.name
    }
  }
}

# --- Function #4: SOW Generation (HTTP Trigger) ---
resource "google_cloudfunctions2_function" "sow_generation_func" {
  project  = var.gcp_project_id
  name     = "sow-generation-func"
  location = var.gcp_region

  build_config {
    runtime     = "python310"
    entry_point = "generate_sow"
    source {
      storage_source {
        bucket = google_storage_bucket.functions_source.name
        object = "sow_generation_func.zip"
      }
    }
  }

  service_config {
    max_instance_count             = 3
    available_memory               = "512Mi"
    timeout_seconds                = 540
    all_traffic_on_latest_revision = true
    service_account_email          = google_service_account.sow_forge_master_sa.email
  }
}

# --- Function #5: Template Generation (HTTP Trigger) ---
resource "google_cloudfunctions2_function" "template_generation_func" {
  project  = var.gcp_project_id
  name     = "template-generation-func"
  location = var.gcp_region

  build_config {
    runtime     = "python310"
    entry_point = "generate_template"
    source {
      storage_source {
        bucket = google_storage_bucket.functions_source.name
        object = "template_generation_func.zip"
      }
    }
  }

  service_config {
    max_instance_count             = 2
    timeout_seconds                = 540
    available_memory               = "512Mi"
    all_traffic_on_latest_revision = true
    service_account_email          = google_service_account.sow_forge_master_sa.email
  }
}

# --- Function #6: Create Google Doc (HTTP Trigger) ---
resource "google_cloudfunctions2_function" "create_google_doc" {
  project  = var.gcp_project_id
  name     = "create-google-doc"
  location = var.gcp_region

  build_config {
    runtime     = "python310"
    entry_point = "create_doc"
    source {
      storage_source {
        bucket = google_storage_bucket.functions_source.name
        object = "create_google_doc.zip"
      }
    }
  }

  service_config {
    max_instance_count             = 2
    timeout_seconds                = 120
    all_traffic_on_latest_revision = true
    service_account_email          = google_service_account.sow_forge_master_sa.email
  }
}
EOF


echo
echo "--------------------------------------------------------"
echo " SUCCESS: All Terraform infrastructure files created."
echo "--------------------------------------------------------"
echo
echo "--- NEXT STEPS ---"
echo "1. Run 'terraform init' to initialize the providers."
echo "2. Ensure all your function zip files are uploaded to the source bucket."
echo "3. Run 'terraform apply' to deploy your infrastructure."
echo