import functions_framework
from google.cloud import storage, firestore
import json
import os

OUTPUT_TEXT_BUCKET_NAME = "sow-forge-texas-dmv-processed-text"

@functions_framework.cloud_event
def handle_batch_result(cloud_event):
    data = cloud_event.data
    bucket_name = data["bucket"]
    file_name = data["name"]

    # This function is triggered by the JSON output of the batch job.
    if not file_name.endswith('.json'):
        print(f"Ignoring file '{file_name}', not a JSON output.")
        return

    print(f"--- BATCH HANDLER START: Processing result file gs://{bucket_name}/{file_name} ---")

    storage_client = storage.Client()
    db = firestore.Client()
    
    try:
        # 1. Read the JSON output file from GCS
        source_bucket = storage_client.bucket(bucket_name)
        blob = source_bucket.blob(file_name)
        json_text = blob.download_as_text()
        result_data = json.loads(json_text)

        # 2. Extract the full text directly from this file's content
        # The full text is already aggregated in the 'text' field of the main document object
        full_text = result_data.get('text', '')
        
        print(f"Extracted {len(full_text)} characters of text from the result file.")

        if not full_text:
            print("Warning: No text found in the result file. Exiting.")
            return

        # 3. Prepare for the next stage
        path_parts = os.path.normpath(file_name).split(os.sep)
        if len(path_parts) < 2:
            print(f"Ignoring file with unexpected path structure: {file_name}")
            return
        
        project_id = path_parts[0]
        doc_id = path_parts[1]

        # This is the correct output path that the next function expects
        output_filename = f"{project_id}/{doc_id}.txt"

        # ... (the rest of the code to save to Firestore and the output bucket is correct) ...
        
        is_template_job = project_id.startswith('template_job_') # Check the project_id instead

        if not is_template_job:
            # Use both projectId and docId to reference the correct Firestore document
            doc_ref = db.collection("sow_projects").document(project_id).collection("source_documents").document(doc_id)
            doc_ref.set({
                "status": "TEXT_EXTRACTED",
                "processing_method": "batch",
                "last_updated_at": firestore.SERVER_TIMESTAMP
            }, merge=True)
            print(f"Updated SOW document status: sow_projects/{project_id}/source_documents/{doc_id}")
        
        # This part is still relevant for the aggregator function
        if is_template_job:
            job_id = project_id.split('_')[2]
            job_ref = db.collection('template_jobs').document(job_id)
            job_ref.update({f'processed_files.{doc_id}': 'Text extracted, ready for aggregation.'}) # doc_id is the file key
            print(f"Updated template job: {job_id}")

        output_bucket = storage_client.bucket(OUTPUT_TEXT_BUCKET_NAME)
        output_blob = output_bucket.blob(output_filename)
        output_blob.metadata = {'processing_mode': 'template_sample' if is_template_job else 'default'}
        output_blob.upload_from_string(full_text)
        
        print(f"--- BATCH HANDLER END: Successfully saved '{output_filename}' ---")

    except Exception as e:
        print(f"!!! CRITICAL ERROR in batch_result_handler: {e}")