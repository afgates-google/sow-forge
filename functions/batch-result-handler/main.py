import functions_framework
from google.cloud import storage, firestore
import json
import os

# --- (1) NEW: Global variable for Firestore clients ---
db = None
storage_client = None
global_settings = None

def init_clients():
    """Initializes global clients and settings to reuse connections."""
    global db, storage_client, global_settings
    if db and storage_client and global_settings:
        return

    db = firestore.Client()
    storage_client = storage.Client()
    
    print("--- Initializing: Loading global_config from Firestore ---")
    settings_doc = db.collection('settings').document('global_config').get()
    if not settings_doc.exists:
        raise Exception("CRITICAL: Global config 'global_config' not found in Firestore!")
    
    global_settings = settings_doc.to_dict()
    print("✅ Global settings loaded successfully.")


@functions_framework.cloud_event
def handle_batch_result(cloud_event):
    """
    Triggered by a GCS event when Document AI completes a batch job.
    This function reads the full text from the job's JSON output
    and saves it to the 'processed-text' bucket for the next stage.
    """
    # --- (2) NEW: Initialize clients and settings on invocation ---
    try:
        init_clients()
    except Exception as e:
        print(f"!!! CLIENT INITIALIZATION FAILED: {e}")
        return # Cannot proceed without settings

    data = cloud_event.data
    bucket_name = data["bucket"]
    file_name = data["name"]

    # This function is triggered by the JSON output of the batch job.
    if not file_name.endswith('.json'):
        print(f"Ignoring file '{file_name}', not a JSON output.")
        return

    print(f"--- BATCH HANDLER START: Processing gs://{bucket_name}/{file_name} ---")
    
    try:
        # 1. Read the JSON output file from GCS
        source_bucket = storage_client.bucket(bucket_name)
        blob = source_bucket.blob(file_name)
        json_text = blob.download_as_text()
        result_data = json.loads(json_text)

        # 2. Extract the full text
        full_text = result_data.get('text', '')
        if not full_text:
            print("Warning: No text found in the result file. Updating status to failed.")
            # Even if it fails, we need to extract IDs to update Firestore status
            project_id, doc_id = _extract_ids_from_path(file_name)
            if project_id and doc_id:
                 doc_ref = db.collection("sow_projects").document(project_id).collection("source_documents").document(doc_id)
                 doc_ref.set({"status": "OCR_FAILED", "status_message": "Document AI did not return any text."}, merge=True)
            return

        # 3. Extract IDs and determine the output path
        project_id, doc_id = _extract_ids_from_path(file_name)
        if not project_id or not doc_id:
            print(f"Ignoring file with unexpected path structure: {file_name}")
            return
            
        output_filename = f"{project_id}/{doc_id}.txt"
        
        # 4. Update Firestore status based on job type
        is_template_job = project_id.startswith('template_job_')
        if not is_template_job:
            doc_ref = db.collection("sow_projects").document(project_id).collection("source_documents").document(doc_id)
            doc_ref.set({
                "status": "TEXT_EXTRACTED",
                "last_updated_at": firestore.SERVER_TIMESTAMP
            }, merge=True)
            print(f"Updated SOW document status: sow_projects/{project_id}/source_documents/{doc_id}")
        else:
            job_id = project_id.split('_')[2]
            job_ref = db.collection('template_jobs').document(job_id)
            job_ref.update({f'processed_files.{doc_id}': 'Text extracted, ready for aggregation.'})
            print(f"Updated template job: {job_id}")

        # --- (3) CHANGED: Use the bucket name from global settings ---
        output_bucket_name = global_settings['gcs_processed_text_bucket']
        output_bucket = storage_client.bucket(output_bucket_name)
        output_blob = output_bucket.blob(output_filename)
        output_blob.upload_from_string(full_text)
        
        print(f"--- BATCH HANDLER END: Successfully saved to gs://{output_bucket_name}/{output_filename} ---")

    except Exception as e:
        print(f"!!! CRITICAL ERROR in batch_result_handler: {e}")
        # Attempt to update Firestore with failure status
        try:
            project_id, doc_id = _extract_ids_from_path(file_name)
            if project_id and doc_id and not project_id.startswith('template_job_'):
                doc_ref = db.collection("sow_projects").document(project_id).collection("source_documents").document(doc_id)
                doc_ref.set({"status": "OCR_FAILED", "status_message": f"Error in batch handler: {str(e)}"}, merge=True)
        except Exception as fe:
            print(f"Could not update Firestore with failure status: {fe}")


def _extract_ids_from_path(gcs_path):
    """Helper to safely extract project_id and doc_id from a GCS path."""
    try:
        path_parts = os.path.normpath(gcs_path).split(os.sep)
        if len(path_parts) >= 2:
            project_id = path_parts[0]
            # The doc_id is the folder name, which is the second part of the path
            doc_id = path_parts[1]
            return project_id, doc_id
    except Exception:
        pass
    return None, None
