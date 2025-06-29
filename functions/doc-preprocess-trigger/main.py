import os
import PyPDF2
import functions_framework
import io
import traceback
from google.cloud import firestore, storage, documentai
from google.api_core.client_options import ClientOptions

# --- Global variables for clients, settings, etc. ---
db = None
storage_client = None
docai_client = None
global_settings = None

def init_clients_and_settings():
    """Initializes global clients and settings to reuse connections."""
    global db, storage_client, docai_client, global_settings
    if all([db, storage_client, docai_client, global_settings]):
        return # Already initialized

    print("--- Initializing clients and loading global_config from Firestore ---")
    db = firestore.Client()
    storage_client = storage.Client()
    
    settings_doc = db.collection('settings').document('global_config').get()
    if not settings_doc.exists:
        raise Exception("CRITICAL: Global config 'global_config' not found in Firestore!")
    
    global_settings = settings_doc.to_dict()

    # Initialize Document AI Client with the correct regional endpoint
    docai_location = global_settings.get("docai_location", "us")
    client_options = ClientOptions(api_endpoint=f"{docai_location}-documentai.googleapis.com")
    docai_client = documentai.DocumentProcessorServiceClient(client_options=client_options)
    
    print("✅ All clients and settings initialized successfully.")


# THIS IS THE CRITICAL FIX: The function name now matches the entry_point in Terraform.
@functions_framework.cloud_event
def doc_preprocess_trigger(cloud_event):
    """
    Triggered by a new file upload. Decides whether to use sync or batch
    Document AI processing based on page count.
    """
    try:
        init_clients_and_settings()
    except Exception as e:
        print(f"!!! CLIENT INITIALIZATION FAILED: {e}")
        return

    data = cloud_event.data
    bucket_name = data["bucket"]
    file_name = data["name"]

    print(f"--- Trigger received for: gs://{bucket_name}/{file_name} ---")

    try:
        project_id, doc_id, original_filename = _extract_ids_from_path(file_name)
        if not all([project_id, doc_id, original_filename]):
             raise ValueError(f"Path must contain project, document, and filename parts. Got: {file_name}")

    except ValueError as e:
        print(f"Ignoring file with unexpected path structure. Error: {e}")
        return

    doc_ref = db.collection('sow_projects').document(project_id).collection('source_documents').document(doc_id)

    try:
        processor_name = docai_client.processor_path(
            global_settings["gcp_project_id"],
            global_settings["docai_location"],
            global_settings["docai_processor_id"]
        )
        sync_page_limit = int(global_settings.get("sync_page_limit", 15))
        output_text_bucket_name = global_settings["gcs_processed_text_bucket"]
        batch_output_bucket_name = global_settings["gcs_batch_output_bucket"]

        blob = storage_client.bucket(bucket_name).blob(file_name)
        pdf_bytes = blob.download_as_bytes()
        page_count = len(PyPDF2.PdfReader(io.BytesIO(pdf_bytes)).pages)

        print(f"Processing '{original_filename}' ({page_count} pages) for project '{project_id}'.")
        doc_ref.update({"status": "PROCESSING_OCR", "page_count": page_count})

        if page_count <= sync_page_limit:
            print("-> Using SYNC processing.")
            request = documentai.ProcessRequest(name=processor_name, raw_document=documentai.RawDocument(content=pdf_bytes, mime_type="application/pdf"))
            result = docai_client.process_document(request=request)
            
            output_blob = storage_client.bucket(output_text_bucket_name).blob(f"{project_id}/{doc_id}.txt")
            output_blob.upload_from_string(result.document.text)
            
            doc_ref.update({"status": "TEXT_EXTRACTED", "processing_method": "sync", "last_updated_at": firestore.SERVER_TIMESTAMP})
            print(f"Sync processing complete. Text saved to gs://{output_text_bucket_name}/{project_id}/{doc_id}.txt")
        else:
            print(f"-> Using BATCH processing (pages > {sync_page_limit}).")
            gcs_doc = documentai.GcsDocument(gcs_uri=f"gs://{bucket_name}/{file_name}", mime_type="application/pdf")
            input_config = documentai.BatchDocumentsInputConfig(gcs_documents=documentai.GcsDocuments(documents=[gcs_doc]))
            
            gcs_output_uri = f"gs://{batch_output_bucket_name}/{project_id}/{doc_id}"
            output_config = documentai.DocumentOutputConfig(gcs_output_config=documentai.DocumentOutputConfig.GcsOutputConfig(gcs_uri=gcs_output_uri))
            
            request = documentai.BatchProcessRequest(name=processor_name, input_documents=input_config, document_output_config=output_config)
            operation = docai_client.batch_process_documents(request=request)
            
            doc_ref.update({"processing_method": "batch", "last_updated_at": firestore.SERVER_TIMESTAMP})
            print(f"Batch processing job started. Operation: {operation.operation.name}")

    except Exception as e:
        error_message = f"!!! CRITICAL ERROR in doc_preprocess_trigger for '{file_name}': {e}"
        print(error_message)
        tb_str = traceback.format_exc()
        print(tb_str)
        doc_ref.update({"status": "OCR_FAILED", "status_message": str(e), "error_traceback": tb_str})

def _extract_ids_from_path(gcs_path):
    """Helper to safely extract project_id, doc_id, and original_filename."""
    try:
        path_parts = os.path.normpath(gcs_path).split(os.sep)
        if len(path_parts) >= 3:
            project_id = path_parts[0]
            doc_id = path_parts[1]
            original_filename = os.path.join(*path_parts[2:])
            return project_id, doc_id, original_filename
    except Exception:
        pass
    return None, None, None