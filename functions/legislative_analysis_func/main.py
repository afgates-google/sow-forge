import functions_framework
import os
import json
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
from google.cloud import storage, firestore
import traceback

# --- Initialize clients in the global scope for reuse ---
db = firestore.Client()
storage_client = storage.Client()

@functions_framework.cloud_event
def analyze_text(cloud_event):
    """
    Analyzes document text from a processed file.
    --- MODIFIED: This function is now a dynamic analyzer. ---
    It reads the document's category and uses a corresponding AI prompt
    to perform a tailored analysis.
    """
    data = cloud_event.data
    bucket_name = data["bucket"]
    # The file_name is now a path like "projectId/docId.txt"
    file_name = data["name"]

    doc_ref = None # Define doc_ref here to be accessible in the except block

    try:
        # --- MODIFIED: Extract project and doc IDs from the GCS path ---
        path_parts = os.path.normpath(file_name).split(os.sep)
        if len(path_parts) != 2:
            print(f"Ignoring file with unexpected path structure: {file_name}")
            return
        
        project_id = path_parts[0]
        doc_id = os.path.splitext(path_parts[1])[0]

        # --- MODIFIED: Reference the document in the new sub-collection structure ---
        doc_ref = db.collection('sow_projects').document(project_id).collection('source_documents').document(doc_id)
        
        # Set status to ANALYZING for immediate UI feedback
        doc_ref.update({"status": "ANALYZING"})
        print(f"Set status to ANALYZING for doc: {doc_id} in project: {project_id}")

        # --- NEW: Fetch document data to get its category ---
        source_doc_data = doc_ref.get().to_dict()
        doc_category = source_doc_data.get('category', 'General') # Default to 'General' if not set

        # --- MODIFIED: Fetch configuration and dynamic prompt mapping from Firestore ---
        settings_ref = db.collection('settings').document('global_config')
        settings = settings_ref.get().to_dict()

        # --- NEW: Initialize Vertex AI with settings from Firestore ---
        GCP_PROJECT_ID = settings.get("gcp_project_id")
        VERTEX_AI_LOCATION = settings.get("vertex_ai_location")
        vertexai.init(project=GCP_PROJECT_ID, location=VERTEX_AI_LOCATION)

        MODEL_NAME = settings.get('legislative_analysis_model', 'gemini-2.5-pro')
        MODEL_TEMPERATURE = settings.get('analysis_model_temperature', 0.2)
        
        # Get the mapping of categories to prompt IDs
        prompt_mapping = settings.get('prompt_mapping', {})
        # Use the mapped prompt ID, or fall back to a default general prompt
        prompt_id = prompt_mapping.get(doc_category, 'general_analysis_prompt')
        print(f"Document category is '{doc_category}'. Using prompt ID: '{prompt_id}'.")

        prompt_ref = db.collection('prompts').document(prompt_id)
        prompt_template = prompt_ref.get().to_dict().get('prompt_text')
        
        model = GenerativeModel(MODEL_NAME)
        # Configure the model to return JSON directly for reliable parsing
        generation_config = GenerationConfig(
            temperature=float(MODEL_TEMPERATURE),
            response_mime_type="application/json"
        )
        
        # --- Download and analyze the ENTIRE document text in a single call ---
        source_bucket = storage_client.bucket(bucket_name)
        blob = source_bucket.blob(file_name)
        document_text = blob.download_as_text()
        print(f"Downloaded {len(document_text)} characters. Analyzing full document...")

        # Construct the final prompt
        final_prompt = prompt_template.replace('{DOCUMENT_TEXT}', document_text)
        
        # Make a SINGLE API call
        response = model.generate_content(final_prompt, generation_config=generation_config)
        
        # Parse the guaranteed-valid JSON response
        analysis_result = json.loads(response.text)

        # Update the Firestore document with the structured analysis results
        doc_ref.update({
            "status": "ANALYZED_SUCCESS",
            "analysis": analysis_result,
            "model_used": MODEL_NAME,
            "prompt_used": prompt_id,
            "temperature_used": float(MODEL_TEMPERATURE),
            "analyzed_at": firestore.SERVER_TIMESTAMP
        })
        print(f"SUCCESS: Saved final analysis for doc '{doc_id}' to Firestore.")

    except Exception as e:
        tb_str = traceback.format_exc()
        error_message = f"!!! CRITICAL ERROR in analysis for file '{file_name}':\n--- EXCEPTION ---\n{e}\n--- TRACEBACK ---\n{tb_str}\n"
        print(error_message)
        if doc_ref:
            doc_ref.update({"status": "ANALYSIS_FAILED", "error_message": str(e), "error_traceback": tb_str})