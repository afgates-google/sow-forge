import os
from google.cloud import firestore

# --- Configuration ---
# The ID of your Google Cloud project
PROJECT_ID = "state-of-texas-sow-demo"
# The collection and document where settings will be stored
SETTINGS_COLLECTION = "settings"
SETTINGS_DOCUMENT = "global_config"

# --- Main Settings Data ---
# This dictionary contains all the settings we want to write to Firestore.
settings_data = {
  "gcp_project_id": "state-of-texas-sow-demo",
  "vertex_ai_location": "us-central1",

  "gcs_uploads_bucket": "sow-forge-texas-dmv-uploads",
  "gcs_processed_text_bucket": "sow-forge-texas-dmv-processed-text",
  "gcs_batch_output_bucket": "sow-forge-texas-dmv-batch-output",
  "gcs_template_samples_bucket": "sow-forge-texas-dmv-template-samples",
  "gcs_templates_bucket": "sow-forge-texas-dmv-templates",
  
  "docai_processor_id": "d64449d9cff40bf1",
  "docai_location": "us",
  "sync_page_limit": 15,
  
  "default_document_category": "General",
  "default_analysis_prompt_id": "general_analysis_prompt",

  "prompt_mapping": {
    "General": "general_analysis_prompt",
    "Legislative / Legal": "legislative_analysis_prompt",
    "Business / Process": "business_analysis_prompt",
    "Technical / Architectural": "technical_analysis_prompt",
    "Financial / Budgetary": "financial_analysis_prompt",
    "Security / Compliance": "security_analysis_prompt",
    "Project Plan / Schedule": "project_plan_analysis_prompt"
  },

  "legislative_analysis_model": "gemini-1.5-pro",
  "analysis_model_temperature": 0.2,

  "sow_generation_model": "gemini-1.5-pro",
  "sow_generation_model_temperature": 0.4,
  "sow_generation_max_tokens": 8192,
  "sow_generation_prompt_id": "sow_generation_prompt_id",
  "sow_title_prefix": "SOW Draft for",
  "ai_review_tag_format": "[DRAFT-AI: {content}]",

  # NOTE: In a production system, you would get these URLs from Terraform output
  # or a service discovery mechanism, not hardcode them.
  "sow_generation_func_url": "https://sow-generation-func-zaolvsfwta-uc.a.run.app",
  "template_generation_func_url": "https://template-generation-func-zaolvsfwta-uc.a.run.app",
  "create_google_doc_func_url": "https://create-google-doc-zaolvsfwta-uc.a.run.app",

  "google_docs_api_scopes": "https://www.googleapis.com/auth/documents",
  "gsuite_delegated_admin_email": "admin-user-to-impersonate@andrewgates.altostrat.com"
}


def main():
    """
    Connects to Firestore and writes the settings data to the specified document.
    """
    try:
        print(f"Attempting to connect to Firestore project: {PROJECT_ID}")
        # When running locally, the client uses your Application Default Credentials.
        # It's good practice to explicitly pass the project ID.
        db = firestore.Client(project=PROJECT_ID)
        
        # Get a reference to the document
        doc_ref = db.collection(SETTINGS_COLLECTION).document(SETTINGS_DOCUMENT)
        
        print(f"Writing settings to document: '{SETTINGS_COLLECTION}/{SETTINGS_DOCUMENT}'")
        
        # Use .set() to create the document or completely overwrite it if it exists.
        # This is ideal for a setup script.
        doc_ref.set(settings_data)
        
        print("\n✅ Success! All settings have been written to Firestore.")

    except Exception as e:
        print(f"\n❌ An error occurred: {e}")
        print("Please ensure you have authenticated with 'gcloud auth application-default login'")
        print("and that the Firestore API is enabled for your project.")

if __name__ == "__main__":
    main()