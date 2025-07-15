import os
import PyPDF2
import functions_framework
import io
import logging
import sys
import base64
import json
import os
import PyPDF2
import functions_framework
import io
import logging
import sys
import base64
import json
from google.cloud import firestore, storage, documentai, secretmanager
from google.api_core.client_options import ClientOptions
from google.auth import credentials

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

db, storage_client, docai_client, global_settings = None, None, None, None

def get_credentials():
    """Gets credentials from Secret Manager or application default."""
    if os.getenv('GAE_ENV', '').startswith('standard'):
        # Production environment
        creds, _ = default()
        return creds
    else:
        # Local development
        secret_client = secretmanager.SecretManagerServiceClient()
        secret_name = f"projects/{os.getenv('GCLOUD_PROJECT')}/secrets/sow-forge-sa-key/versions/latest"
        response = secret_client.access_secret_version(name=secret_name)
        secret_payload = response.payload.data.decode('UTF-8')
        creds_info = json.loads(secret_payload)
        return credentials.Credentials.from_authorized_user_info(creds_info)

def init_clients_and_settings():
    """Initializes global clients and settings to reuse connections."""
    global db, storage_client, docai_client, global_settings
    if all((db, storage_client, docai_client, global_settings)):
        return

    logger.info("--- Initializing clients and loading global_config ---")
    creds = get_credentials()
    db = firestore.Client(credentials=creds)
    storage_client = storage.Client(credentials=creds)
    
    settings_doc = db.collection('settings').document('global_config').get()
    if not settings_doc.exists:
        raise Exception("CRITICAL: Global config 'global_config' not found in Firestore!")
    global_settings = settings_doc.to_dict()
    
    docai_base_url = global_settings.get('docai_base_url', 'documentai.googleapis.com')
    opts = ClientOptions(api_endpoint=f"{global_settings.get('docai_location', 'us')}-{docai_base_url}")
    docai_client = documentai.DocumentProcessorServiceClient(client_options=opts, credentials=creds)
    logger.info("✅ All clients and settings initialized successfully.")

@functions_framework.cloud_event
def doc_preprocess_trigger(cloud_event): # CORRECTED NAME
    """Decides whether to use sync or batch Document AI processing."""
    try:
        init_clients_and_settings()
    except Exception as e:
        logger.critical(f"!!! CLIENT INITIALIZATION FAILED: {e}", exc_info=True)
        return

    try:
        if 'message' in cloud_event.data and 'data' in cloud_event.data['message']:
            payload_str = base64.b64decode(cloud_event.data['message']['data']).decode('utf-8')
            event_data = json.loads(payload_str)
            logger.info("Received manual Pub/Sub trigger.")
        else:
            event_data = cloud_event.data
            logger.info("Received GCS event trigger from Eventarc.")
        bucket_name, file_name = event_data["bucket"], event_data["name"]
    except Exception as e:
        logger.error(f"!!! Could not parse event data: {e}. Payload: {cloud_event.data}", exc_info=True)
        return

    logger.info(f"--- Trigger received for: gs://{bucket_name}/{file_name} ---")
    project_id, doc_id, _ = _extract_ids_from_path(file_name)
    if not all((project_id, doc_id)):
        logger.warning(f"Ignoring file with unexpected path structure: {file_name}")
        return

    doc_ref = db.collection('sow_projects').document(project_id).collection('source_documents').document(doc_id)
    try:
        processor_name = docai_client.processor_path(global_settings["gcp_project_id"], global_settings["docai_location"], global_settings["docai_processor_id"])
        
        blob = storage_client.bucket(bucket_name).blob(file_name)
        pdf_bytes = blob.download_as_bytes()
        page_count = len(PyPDF2.PdfReader(io.BytesIO(pdf_bytes)).pages)
        
        doc_ref.update({"status": "PROCESSING_OCR", "page_count": page_count})
        
        if page_count <= int(global_settings["doc_ai_sync_page_limit"]):
            logger.info(f"Using SYNC processing for {file_name} ({page_count} pages).")
            request = documentai.ProcessRequest(name=processor_name, raw_document=documentai.RawDocument(content=pdf_bytes, mime_type="application/pdf"))
            result = docai_client.process_document(request=request)
            storage_client.bucket(global_settings["gcs_processed_text_bucket"]).blob(f"{project_id}/{doc_id}.txt").upload_from_string(result.document.text)
            doc_ref.update({"status": "TEXT_EXTRACTED", "processing_method": "sync", "last_updated_at": firestore.SERVER_TIMESTAMP})
            logger.info(f"SYNC processing successful for {file_name}.")
        else:
            logger.info(f"Using BATCH processing for {file_name} ({page_count} pages).")
            gcs_doc = documentai.GcsDocument(gcs_uri=f"gs://{bucket_name}/{file_name}", mime_type="application/pdf")
            input_config = documentai.BatchDocumentsInputConfig(gcs_documents=documentai.GcsDocuments(documents=[gcs_doc]))
            gcs_output_uri = f"gs://{global_settings['gcs_batch_output_bucket']}/{project_id}/{doc_id}"
            output_config = documentai.DocumentOutputConfig(gcs_output_config=documentai.DocumentOutputConfig.GcsOutputConfig(gcs_uri=gcs_output_uri))
            request = documentai.BatchProcessRequest(name=processor_name, input_documents=input_config, document_output_config=output_config)
            docai_client.batch_process_documents(request=request)
            doc_ref.update({"processing_method": "batch", "last_updated_at": firestore.SERVER_TIMESTAMP})
            logger.info(f"BATCH processing initiated for {file_name}.")

    except Exception as e:
        error_message = f"!!! CRITICAL ERROR in doc_preprocess_trigger for {file_name}"
        logger.critical(error_message, exc_info=True)
        doc_ref.update({"status": "OCR_FAILED", "status_message": str(e), "error_traceback": logging.traceback.format_exc()})

def _extract_ids_from_path(gcs_path):
    try:
        path_parts = os.path.normpath(gcs_path).split(os.sep)
        if len(path_parts) >= 3:
            return path_parts[0], path_parts[1], os.path.join(*path_parts[2:])
    except Exception:
        pass
    return None, None, None