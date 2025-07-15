import os
import subprocess
import json
from google.cloud import firestore

# --- Configuration ---
PROJECT_ID = os.getenv("GCLOUD_PROJECT", subprocess.check_output("gcloud config get-value project", shell=True, text=True).strip())
REGION = "us-central1"
SETTINGS_COLLECTION = "settings"
SETTINGS_DOCUMENT = "global_config"

def get_function_url(func_name):
    """Gets the URL of a deployed Cloud Function."""
    try:
        command = f"gcloud functions describe {func_name} --project={PROJECT_ID} --region={REGION} --format='value(serviceConfig.uri)'"
        url = subprocess.check_output(command, shell=True, text=True).strip()
        print(f"  -> Found URL for {func_name}: {url}")
        return url
    except subprocess.CalledProcessError:
        print(f"  -> WARNING: Could not find URL for function '{func_name}'. Using placeholder.")
        return f"https://{func_name}-placeholder-url.a.run.app"

def main():
    """
    Connects to Firestore and writes the settings data to the specified document.
    """
    try:
        print(f"--- Updating Firestore settings in project: {PROJECT_ID} ---")
        db = firestore.Client(project=PROJECT_ID)
        doc_ref = db.collection(SETTINGS_COLLECTION).document(SETTINGS_DOCUMENT)

        # Define all settings that should be in the document
        settings_data = {
            "gcp_project_id": PROJECT_ID,
            "vertex_ai_location": REGION,
            "gcs_uploads_bucket": f"sow-forge-{PROJECT_ID}-uploads",
            "gcs_templates_bucket": f"sow-forge-{PROJECT_ID}-templates",
            "eventarc_gcs_uploads_topic": "sow-forge-gcs-uploads",
            "sow_generation_model": "gemini-1.5-pro",
            "sow_generation_prompt_id": "sow_generation_default",
            "sow_generation_model_temperature": 0.4,
            "sow_generation_max_tokens": 8192,
            "sow_title_prefix": "SOW Draft for",
            "sow_generation_func_url": get_function_url("sow-generation-func"),
            "template_generation_func_url": get_function_url("template-generation-func"),
            "create_google_doc_func_url": get_function_url("create-google-doc")
        }

        print(f"\nWriting settings to: '{SETTINGS_COLLECTION}/{SETTINGS_DOCUMENT}'")
        doc_ref.set(settings_data) # Overwrite the document with the complete, correct settings
        
        print("\n✅ Success! All settings have been written to Firestore.")

    except Exception as e:
        print(f"\n❌ An error occurred: {e}")
        print("Please ensure you have authenticated with 'gcloud auth application-default login'")
        print("and that the Firestore API is enabled for your project.")

if __name__ == "__main__":
    main()