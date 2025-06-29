import functions_framework
import os
import json
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
from google.cloud import storage, firestore
import traceback

# --- (1) NEW: Global variables for clients, settings, etc. ---
db = None
storage_client = None
global_settings = None

def init_clients_and_settings():
    """Initializes global clients and settings to reuse connections."""
    global db, storage_client, global_settings
    if all([db, storage_client, global_settings]):
        return # Already initialized

    print("--- Initializing clients and loading global_config ---")
    db = firestore.Client()
    storage_client = storage.Client()
    
    settings_doc = db.collection('settings').document('global_config').get()
    if not settings_doc.exists:
        raise Exception("CRITICAL: Global config 'global_config' not found in Firestore!")
    
    global_settings = settings_doc.to_dict()
    
    # Initialize Vertex AI client
    vertexai.init(
        project=global_settings["gcp_project_id"],
        location=global_settings["vertex_ai_location"]
    )
    print("✅ All clients and settings initialized successfully.")


@functions_framework.cloud_event
def analyze_text(cloud_event):
    """
    Analyzes document text using a dynamically selected prompt based on the
    document's category.
    """
    # --- (2) NEW: Initialize clients and settings on invocation ---
    try:
        init_clients_and_settings()
    except Exception as e:
        print(f"!!! CLIENT INITIALIZATION FAILED: {e}")
        return

    data = cloud_event.data
    bucket_name = data["bucket"]
    file_name = data["name"]
    doc_ref = None

    try:
        # 1. Extract IDs and get a reference to the Firestore document
        path_parts = os.path.normpath(file_name).split(os.sep)
        if len(path_parts) != 2:
            raise ValueError(f"Expected path 'projectId/docId.txt', got '{file_name}'")
        
        project_id = path_parts[0]
        doc_id = os.path.splitext(path_parts[1])[0]
        doc_ref = db.collection('sow_projects').document(project_id).collection('source_documents').document(doc_id)
        
        doc_ref.update({"status": "ANALYZING"})
        print(f"Set status to ANALYZING for doc: {doc_id} in project: {project_id}")

        # 2. Get document category and select the correct prompt
        source_doc_data = doc_ref.get().to_dict()
        doc_category = source_doc_data.get('category', 'General')
        
        prompt_mapping = global_settings.get('prompt_mapping', {})
        prompt_id = prompt_mapping.get(doc_category, global_settings.get('default_analysis_prompt_id', 'general_analysis_prompt'))
        print(f"Document category is '{doc_category}'. Using prompt ID: '{prompt_id}'.")

        prompt_ref = db.collection('prompts').document(prompt_id)
        prompt_doc = prompt_ref.get()
        if not prompt_doc.exists:
            raise ValueError(f"Prompt document '{prompt_id}' not found in Firestore.")
        prompt_template = prompt_doc.to_dict().get('prompt_text')

        # 3. Prepare the model and configuration
        model_name = global_settings.get('legislative_analysis_model', 'gemini-1.5-pro-preview-0409')
        model_temp = float(global_settings.get('analysis_model_temperature', 0.2))
        
        model = GenerativeModel(model_name)
        generation_config = GenerationConfig(
            temperature=model_temp,
            response_mime_type="application/json"
        )
        
        # 4. Download text, construct prompt, and call the AI model
        blob = storage_client.bucket(bucket_name).blob(file_name)
        document_text = blob.download_as_text()
        print(f"Analyzing {len(document_text)} characters...")

        final_prompt = prompt_template.replace('{DOCUMENT_TEXT}', document_text)
        response = model.generate_content(final_prompt, generation_config=generation_config)
        analysis_result = json.loads(response.text)

        # 5. Save successful results to Firestore
        doc_ref.update({
            "status": "ANALYZED_SUCCESS",
            "analysis": analysis_result,
            "model_used": model_name,
            "prompt_used": prompt_id,
            "temperature_used": model_temp,
            "analyzed_at": firestore.SERVER_TIMESTAMP
        })
        print(f"SUCCESS: Saved final analysis for doc '{doc_id}' to Firestore.")

    except Exception as e:
        tb_str = traceback.format_exc()
        error_message = f"!!! CRITICAL ERROR in analysis for file '{file_name}': {str(e)}"
        print(error_message)
        print(tb_str)
        if doc_ref:
            doc_ref.update({"status": "ANALYSIS_FAILED", "error_message": error_message, "error_traceback": tb_str})
