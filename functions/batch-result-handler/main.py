import functions_framework
from google.cloud import storage, firestore
import json
import os
import logging
import sys

# --- Logging Setup ---
# Configure root logger to log to stdout
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
    logger.info("✅ Global settings loaded successfully.")

@functions_framework.cloud_event
def batch_result_handler(cloud_event): # CORRECTED NAME
    """Handles the result of a Document AI batch processing job."""
    try:
        init_clients_and_settings()
    except Exception as e:
        logger.critical(f"!!! CLIENT INITIALIZATION FAILED: {e}", exc_info=True)
        return

    file_name = ""
    try:
        data = cloud_event.data
        bucket_name, file_name = data["bucket"], data["name"]
        if not file_name.endswith('.json'):
            logger.info(f"Ignoring file '{file_name}', not a JSON output.")
            return

        logger.info(f"--- BATCH HANDLER START: Processing gs://{bucket_name}/{file_name} ---")
        project_id, doc_id = _extract_ids_from_path(file_name)
        if not project_id or not doc_id:
            raise ValueError(f"Could not extract IDs from path: {file_name}")

        blob = storage_client.bucket(bucket_name).blob(file_name)
        result_data = json.loads(blob.download_as_text())
        full_text = result_data.get('text', '')

        doc_ref = db.collection("sow_projects").document(project_id).collection("source_documents").document(doc_id)
        if not full_text:
            logger.warning("Warning: No text in result file. Updating status to failed.")
            doc_ref.set({"status": "OCR_FAILED", "status_message": "Document AI batch job did not return text."}, merge=True)
            return

        output_bucket_name = global_settings['gcs_processed_text_bucket']
        storage_client.bucket(output_bucket_name).blob(f"{project_id}/{doc_id}.txt").upload_from_string(full_text)
        
        doc_ref.set({"status": "TEXT_EXTRACTED", "last_updated_at": firestore.SERVER_TIMESTAMP}, merge=True)
        logger.info(f"--- BATCH HANDLER END: Successfully processed gs://{output_bucket_name}/{project_id}/{doc_id}.txt ---")

    except Exception as e:
        logger.critical("!!! CRITICAL ERROR in batch_result_handler", exc_info=True)
        try:
            # Attempt to update Firestore with failure status even if something else went wrong
            if file_name:
                project_id, doc_id = _extract_ids_from_path(file_name)
                if project_id and doc_id:
                    doc_ref = db.collection("sow_projects").document(project_id).collection("source_documents").document(doc_id)
                    doc_ref.set({"status": "OCR_FAILED", "status_message": f"Error in batch handler: {str(e)}"}, merge=True)
        except Exception as fe:
            logger.error(f"Could not update Firestore with failure status", exc_info=True)

def _extract_ids_from_path(gcs_path):
    """Helper to safely extract project_id and doc_id from a GCS path."""
    try:
        path_parts = os.path.normpath(gcs_path).split(os.sep)
        if len(path_parts) >= 2:
            return path_parts[0], path_parts[1]
    except Exception:
        pass
    return None, None
