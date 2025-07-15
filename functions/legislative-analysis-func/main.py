import functions_framework
import os
import json
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig, HarmCategory, HarmBlockThreshold
from google.cloud import storage, firestore
import logging
import sys

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

db = None
storage_client = None
global_settings = None

def init_clients_and_settings():
    """Initializes global clients and settings to reuse connections."""
    global db, storage_client, global_settings
    if all((db, storage_client, global_settings)):
        return

    logger.info("--- Initializing clients and loading global_config ---")
    db = firestore.Client()
    storage_client = storage.Client()
    settings_doc = db.collection('settings').document('global_config').get()
    if not settings_doc.exists:
        raise Exception("CRITICAL: Global config 'global_config' not found in Firestore!")
    global_settings = settings_doc.to_dict()
    vertexai.init(project=global_settings["gcp_project_id"], location=global_settings["vertex_ai_location"])
    logger.info("✅ All clients and settings initialized successfully.")

@functions_framework.cloud_event
def legislative_analysis_func(cloud_event): # CORRECTED NAME
    """Analyzes text using a dynamically selected prompt based on category."""
    try:
        init_clients_and_settings()
    except Exception as e:
        logger.critical(f"!!! CLIENT INITIALIZATION FAILED: {e}", exc_info=True)
        return

    doc_ref = None
    try:
        data = cloud_event.data
        bucket_name, file_name = data["bucket"], data["name"]
        path_parts = os.path.normpath(file_name).split(os.sep)
        if len(path_parts) != 2:
            raise ValueError(f"Expected path 'projectId/docId.txt', got '{file_name}'")
        
        project_id, doc_id = path_parts[0], os.path.splitext(path_parts[1])[0]
        doc_ref = db.collection('sow_projects').document(project_id).collection('source_documents').document(doc_id)
        
        doc_ref.update({"status": "ANALYZING"})
        source_doc_data = doc_ref.get().to_dict()
        doc_category = source_doc_data.get('category', 'General')
        
        prompt_mapping = global_settings.get('prompt_mapping', {})
        prompt_id = prompt_mapping.get(doc_category, global_settings.get('default_analysis_prompt_id', 'general_analysis_prompt'))
        logger.info(f"Document category is '{doc_category}'. Using prompt ID: '{prompt_id}'.")

        prompt_ref = db.collection('prompts').document(prompt_id)
        prompt_doc = prompt_ref.get()
        if not prompt_doc.exists:
            raise ValueError(f"Prompt document '{prompt_id}' not found in Firestore.")
        prompt_template = prompt_doc.to_dict().get('prompt_text')

        model_name = global_settings.get('legislative_analysis_model', 'gemini-1.5-pro')
        model_temp = float(global_settings.get('analysis_model_temperature', 0.2))
        
        # 1. Define safety settings
        safety_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        }
        
        # 2. Update the GenerationConfig
        model = GenerativeModel(model_name)
        generation_config = GenerationConfig(
            temperature=model_temp,
            response_mime_type="application/json"
        )
        
        document_text = storage_client.bucket(bucket_name).blob(file_name).download_as_text()
        final_prompt = prompt_template.replace('{DOCUMENT_TEXT}', document_text)
        
        # 3. Add safety_settings to the generate_content call
        response = model.generate_content(
            final_prompt,
            generation_config=generation_config,
            safety_settings=safety_settings
        )

        # 4. Add a check for an empty response
        if not response.candidates or not response.candidates[0].content.parts:
            raise ValueError("The analysis model returned an empty response. This may be due to safety filters or an issue with the prompt.")

        analysis_result = json.loads(response.text)

        doc_ref.update({
            "status": "ANALYZED_SUCCESS",
            "analysis": analysis_result,
            "analyzed_at": firestore.SERVER_TIMESTAMP
        })
        logger.info(f"SUCCESS: Saved final analysis for doc '{doc_id}' to Firestore.")

    except Exception as e:
        error_message = f"!!! CRITICAL ERROR in analysis for doc '{file_name}'"
        logger.critical(error_message, exc_info=True)
        if doc_ref:
            doc_ref.update({"status": "ANALYSIS_FAILED", "error_message": str(e), "error_traceback": logging.traceback.format_exc()})
