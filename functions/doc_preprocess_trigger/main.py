import os
import PyPDF2
import functions_framework
import io
import traceback # <-- FIX #1: Import the traceback module
from google.cloud import firestore, storage, documentai
from google.api_core.client_options import ClientOptions

@functions_framework.cloud_event
def process_pdf(cloud_event):
    data = cloud_event.data
    bucket_name = data["bucket"]
    file_name = data["name"]

    print(f"--- Trigger received for: gs://{bucket_name}/{file_name} ---")

    db = firestore.Client()
    storage_client = storage.Client()
    
    try:
        path_parts = os.path.normpath(file_name).split(os.sep)
        if len(path_parts) < 3:
            raise ValueError(f"Path must contain at least 3 parts, but got {len(path_parts)}")
        
        project_id, doc_id, original_filename = path_parts[0], path_parts[1], os.path.join(*path_parts[2:])
    except ValueError as e:
        print(f"Ignoring file with unexpected path structure: {file_name}. Error: {e}")
        return

    doc_ref = db.collection('sow_projects').document(project_id).collection('source_documents').document(doc_id)

    try:
        settings_ref = db.collection('settings').document('global_config')
        settings = settings_ref.get().to_dict()
        if not settings:
            raise ValueError("Global settings 'global_config' not found.")

        # Keep these as they are correct
        GCP_PROJECT_ID = settings.get("gcp_project_id")
        DOCAI_PROCESSOR_ID = settings.get("docai_processor_id")
        DOCAI_LOCATION = settings.get("docai_location", "us")
        SYNC_PAGE_LIMIT = int(settings.get("sync_page_limit", 15))

        # --- FIX: Align variable names with Firestore keys ---
        OUTPUT_TEXT_BUCKET_NAME = settings.get("gcs_processed_text_bucket")
        BATCH_OUTPUT_BUCKET_NAME = settings.get("gcs_batch_output_bucket")

        # Add a validation check for the newly fixed names
        if not all([OUTPUT_TEXT_BUCKET_NAME, BATCH_OUTPUT_BUCKET_NAME]):
            raise ValueError("GCS bucket names for processed text or batch output are missing from settings.")

        # --- FIX #2: Use the correct client class name ---
        client_options = ClientOptions(api_endpoint=f"{DOCAI_LOCATION}-documentai.googleapis.com")
        docai_client = documentai.DocumentProcessorServiceClient(client_options=client_options)
        
        processor_name = docai_client.processor_path(GCP_PROJECT_ID, DOCAI_LOCATION, DOCAI_PROCESSOR_ID)

        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_name)
        pdf_bytes = blob.download_as_bytes()
        page_count = len(PyPDF2.PdfReader(io.BytesIO(pdf_bytes)).pages)

        print(f"Processing '{original_filename}' with {page_count} pages for project '{project_id}'.")
        
        doc_ref.update({"status": "PROCESSING_OCR", "page_count": page_count, "gcsPath": f"gs://{bucket_name}/{file_name}"})

        if page_count <= SYNC_PAGE_LIMIT:
            request = documentai.ProcessRequest(name=processor_name, raw_document=documentai.RawDocument(content=pdf_bytes, mime_type="application/pdf"))
            result = docai_client.process_document(request=request)
            output_blob = storage_client.bucket(OUTPUT_TEXT_BUCKET_NAME).blob(f"{project_id}/{doc_id}.txt")
            output_blob.upload_from_string(result.document.text)
            doc_ref.update({"status": "TEXT_EXTRACTED", "processing_method": "sync", "last_updated_at": firestore.SERVER_TIMESTAMP})
            print(f"Sync processing complete. Text saved.")
        else:
            gcs_doc = documentai.GcsDocument(gcs_uri=f"gs://{bucket_name}/{file_name}", mime_type="application/pdf")
            input_config = documentai.BatchDocumentsInputConfig(gcs_documents=documentai.GcsDocuments(documents=[gcs_doc]))
            gcs_output_uri = f"gs://{BATCH_OUTPUT_BUCKET_NAME}/{project_id}/{doc_id}"
            print(f"Setting batch output URI to: {gcs_output_uri}")
            output_config = documentai.DocumentOutputConfig(
                gcs_output_config=documentai.DocumentOutputConfig.GcsOutputConfig(
                    gcs_uri=gcs_output_uri
                )
            )
            
            request = documentai.BatchProcessRequest(name=processor_name, input_documents=input_config, document_output_config=output_config)
            docai_client.batch_process_documents(request)
            doc_ref.update({"processing_method": "batch", "last_updated_at": firestore.SERVER_TIMESTAMP})
            print(f"Batch processing job started for {original_filename}.")

    except Exception as e:
        error_message = f"!!! CRITICAL ERROR in process_pdf for '{file_name}': {e}"
        print(error_message)
        tb_str = traceback.format_exc()
        print(tb_str)
        doc_ref.update({"status": "OCR_FAILED", "error_message": str(e), "error_traceback": tb_str})