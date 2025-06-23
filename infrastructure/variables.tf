# -----------------------------------------------------------------------------
# PROJECT & REGION CONFIGURATION
# -----------------------------------------------------------------------------
variable "gcp_project_id" {
  description = "The GCP project ID."
  type        = string
  default     = "state-of-texas-sow-demo"
}

variable "gcp_region" {
  description = "The GCP region for primary resources like Cloud Functions."
  type        = string
  default     = "us-central1"
}

variable "gcs_location" {
  description = "The location for the GCS buckets (e.g., US, US-CENTRAL1)."
  type        = string
  default     = "US"
}

variable "firestore_location" {
  description = "The multi-region location for the Firestore database."
  type        = string
  default     = "nam5" # Corresponds to us-central
}

# -----------------------------------------------------------------------------
# SERVICE ACCOUNT & IAM CONFIGURATION
# -----------------------------------------------------------------------------
variable "master_service_account_id" {
  description = "The short name for the master service account."
  type        = string
  default     = "sow-forge-master-sa"
}

# -----------------------------------------------------------------------------
# APPLICATION-SPECIFIC CONFIGURATION
# -----------------------------------------------------------------------------
variable "docai_processor_location" {
  description = "The location of the Document AI processor."
  type        = string
  default     = "us"
}

variable "docai_processor_id" {
  description = "The ID of the Document AI OCR Processor."
  type        = string
  default     = "d64449d9cff40bf1" # Your specific processor ID
}

# -----------------------------------------------------------------------------
# GCS BUCKET NAME CONFIGURATION
# -----------------------------------------------------------------------------
variable "bucket_prefix" {
  description = "A prefix to apply to all GCS buckets for this project."
  type        = string
  default     = "sow-forge-texas-dmv"
}

variable "bucket_names" {
  description = "A map of logical bucket names to their suffixes."
  type        = map(string)
  default = {
    uploads          = "uploads"
    processed_text   = "processed-text"
    functions_source = "functions-source"
    template_samples = "template-samples"
    templates        = "templates"
    batch_output     = "batch-output"
  }
}