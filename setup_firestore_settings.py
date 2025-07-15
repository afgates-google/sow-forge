import os
import subprocess
import json
from google.cloud import firestore
import logging
import sys

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Configuration ---
PROJECT_ID = os.getenv("GCLOUD_PROJECT", subprocess.check_output("gcloud config get-value project", shell=True, text=True).strip())
REGION = "us-central1"
SETTINGS_COLLECTION = "settings"
PROMPTS_COLLECTION = "prompts"
SETTINGS_DOCUMENT = "global_config"

def get_function_url(func_name):
    """Gets the URL of a deployed Cloud Function."""
    try:
        command = f"gcloud functions describe {func_name} --project={PROJECT_ID} --region={REGION} --format='value(serviceConfig.uri)'"
        url = subprocess.check_output(command, shell=True, text=True).strip()
        logger.info(f"  -> Found URL for {func_name}: {url}")
        return url
    except subprocess.CalledProcessError:
        logger.warning(f"  -> WARNING: Could not find URL for function '{func_name}'. Using placeholder.")
        return f"https://{func_name}-placeholder-url.a.run.app"

def upsert_prompt(db, prompt_id, prompt_text, name=""):
    """Creates or updates a prompt in the prompts collection."""
    prompt_ref = db.collection(PROMPTS_COLLECTION).document(prompt_id)
    prompt_data = {
        'prompt_text': prompt_text,
        'name': name or prompt_id.replace('_', ' ').title()
    }
    prompt_ref.set(prompt_data, merge=True)
    logger.info(f"  -> Upserted prompt: '{prompt_id}'")

def main():
    """
    Connects to Firestore and writes the settings and default prompts.
    """
    try:
        logger.info(f"--- Updating Firestore settings and prompts in project: {PROJECT_ID} ---")
        db = firestore.Client(project=PROJECT_ID)
        
        # --- 1. Upsert Prompts ---
        logger.info("--- Upserting prompts... ---")
        meta_summary_prompt_text = "Synthesize these individual document summaries into a single, cohesive project overview paragraph:\n\n{summaries_json}"
        upsert_prompt(db, "meta_summary_prompt", meta_summary_prompt_text, "Meta Summary Prompt")

        # --- 2. Define Settings ---
        logger.info("\n--- Defining settings... ---")
        settings_data = {
            "gcp_project_id": PROJECT_ID,
            "vertex_ai_location": REGION,
            "gcs_uploads_bucket": f"sow-forge-{PROJECT_ID}-uploads",
            "gcs_templates_bucket": f"sow-forge-{PROJECT_ID}-templates",
            "gcs_signed_url_expiration_minutes": 15,
            "eventarc_gcs_uploads_topic": "sow-forge-gcs-uploads",
            "sow_generation_model": "gemini-1.5-pro",
            "sow_generation_prompt_id": "sow_generation_default",
            "meta_summary_prompt_id": "meta_summary_prompt",
            "sow_generation_model_temperature": 0.4,
            "sow_generation_max_tokens": 8192,
            "sow_title_prefix": "SOW Draft for",
            "sow_generation_func_url": get_function_url("sow-generation-func"),
            "template_generation_func_url": get_function_url("template-generation-func"),
            "create_google_doc_func_url": get_function_url("create-google-doc"),
            "vertex_ai_safety_threshold": "BLOCK_ONLY_HIGH",
            "doc_ai_sync_page_limit": 15,
            "default_analysis_prompt_id": "general_analysis_prompt",
            "google_docs_base_url": "https://docs.google.com/document/d/",
            "docai_base_url": "documentai.googleapis.com"
        }

        # --- 3. Write Settings ---
        settings_doc_ref = db.collection(SETTINGS_COLLECTION).document(SETTINGS_DOCUMENT)
        logger.info(f"\n--- Writing settings to: '{SETTINGS_COLLECTION}/{SETTINGS_DOCUMENT}' ---")
        settings_doc_ref.set(settings_data)
        
        logger.info("\n✅ Success! All settings and prompts have been written to Firestore.")

    except Exception as e:
        logger.critical(f"\n❌ An error occurred: {e}", exc_info=True)
        logger.error("Please ensure you have authenticated with 'gcloud auth application-default login'")
        logger.error("and that the Firestore API is enabled for your project.")

if __name__ == "__main__":
    main()