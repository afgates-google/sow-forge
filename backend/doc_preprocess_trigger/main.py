import functions_framework
from google.cloud import documentai, storage, firestore
from PyPDF2 import PdfReader
import os
import io
from google.api_core.client_options import ClientOptions

@functions_framework.cloud_event
def process_pdf(cloud_event):
    """
    Acts as a router for incoming legislative bill PDFs.
    1. Fetches its configuration from Firestore.
    2. Creates an initial tracking document in the 'sows' collection.
    3. Checks the PDF page count and routes to sync or batch OCR.
    """
    # --- Initialize clients ---
    storage_client = storage.Client()
    db = firestore.Client()
    
    file_name = "unknown_file" 

    try:
        # --- 1. Fetch Global Settings from Firestore ---
        settings_ref = db.collection('settings').document('global_config')
        settings = settings_ref.get().to_dict()

        GCP_PROJECT_NUMBER = settings.get("gcp_project_number")
        DOCAI_PROCESSOR_ID = settings.get("docai_processor_id")
        DOCAI_LOCATION = settings.get("docai_location", "us")
        SYNC_PAGE_LIMIT = int(settings.get("sync_page_limit", 15))
        OUTPUT_TEXT_BUCKET_NAME = settings.get("processed_text_bucket")
        BATCH_OUTPUT_BUCKET_NAME = settings.get("batch_output_bucket")
        
        if not all([GCP_PROJECT_NUMBER, DOCAI_PROCESSOR_ID, DOCAI_LOCATION]):
            raise Exception("Required settings (processor, location, project number) are missing from Firestore.")

        opts = documentai.client_options.ClientOptions(api_endpoint=f"{DOCAI_LOCATION}-documentai.googleapis.com")
        docai_client = documentai.DocumentProcessorServiceClient(client_options=opts)
        PROCESSOR_PATH = f"projects/{GCP_PROJECT_NUMBER}/locations/{DOCAI_LOCATION}/processors/{DOCAI_PROCESSOR_ID}"
        print(f"Using configuration - Processor: {DOCAI_PROCESSOR_ID}")

        # --- 2. Get Event Data ---
        data = cloud_event.data
        bucket_name = data["bucket"]
        file_name = data["name"]
        
        source_bucket = storage_client.bucket(bucket_name)
        blob = source_bucket.blob(file_name)
        
        # --- 3. Get Page Count ---
        pdf_bytes = blob.download_as_bytes()
        reader = PdfReader(io.BytesIO(pdf_bytes))
        page_count = len(reader.pages)
        print(f"Processing '{file_name}': Found {page_count} pages.")
        
        # --- 4. Create Firestore Record ---
        doc_id = os.path.splitext(file_name)[0]
        doc_ref = db.collection("sows").document(doc_id)
        doc_ref.set({
            "original_filename": file_name,
            "display_name": file_name,
            "status": "PROCESSING_OCR",
            "page_count": page_count,
            "created_at": firestore.SERVER_TIMESTAMP,
            "last_updated_at": firestore.SERVER_TIMESTAMP,
            "is_template_sample": False
        }, merge=True)
        print(f"Created initial SOW document with ID: {doc_id}")

        # --- 5. Route to Sync or Batch Processing ---
        if page_count <= SYNC_PAGE_LIMIT:
            print("Using synchronous processing.")
            gcs_document = documentai.GcsDocument(gcs_uri=f"gs://{bucket_name}/{file_name}", mime_type="application/pdf")
            request = documentai.ProcessRequest(name=PROCESSOR_PATH, gcs_document=gcs_document)
            result = docai_client.process_document(request=request)
            document_text = result.document.text

            output_bucket = storage_client.bucket(OUTPUT_TEXT_BUCKET_NAME)
            output_blob = output_bucket.blob(f"{doc_id}.txt")
            output_blob.upload_from_string(document_text)
            print(f"Sync processing complete. Saved text to '{output_blob.name}'.")

        else:
            print("Using asynchronous batch processing.")
            gcs_documents = documentai.GcsDocuments(documents=[documentai.GcsDocument(gcs_uri=f"gs://{bucket_name}/{file_name}", mime_type="application/pdf")])
            input_config = documentai.BatchDocumentsInputConfig(gcs_documents=gcs_documents)
            
            output_config = documentai.DocumentOutputConfig(
                gcs_output_config=documentai.DocumentOutputConfig.GcsOutputConfig(gcs_uri=f"gs://{BATCH_OUTPUT_BUCKET_NAME}/{doc_id}/")
            )
            request = documentai.BatchProcessRequest(
                name=PROCESSOR_PATH,
                input_documents=input_config,
                document_output_config=output_config,
            )
            operation = docai_client.batch_process_documents(request=request)
            print(f"Batch processing job started. Operation name: {operation.operation.name}")
            
    except Exception as e:
        print(f"!!! CRITICAL ERROR in doc_preprocess_trigger for file '{file_name}': {e}")
        if file_name != "unknown_file":
            doc_id_for_error = os.path.splitext(file_name)[0]
            doc_ref = db.collection("sows").document(doc_id_for_error)
            doc_ref.set({"status": "OCR_FAILED", "error_message": str(e)}, merge=True)