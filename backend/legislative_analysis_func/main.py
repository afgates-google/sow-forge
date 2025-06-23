import functions_framework
import os
import json
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
from google.cloud import storage, firestore
import traceback

@functions_framework.cloud_event
def analyze_text(cloud_event):
    """
    Analyzes legislative text from a processed text file. This function
    now assumes it will only be triggered for legitimate SOW documents.
    """
    # --- Initialize clients and variables ---
    db = firestore.Client()
    storage_client = storage.Client()
    
    data = cloud_event.data
    bucket_name = data["bucket"]
    file_name = data["name"]
    doc_id = os.path.splitext(file_name)[0]
    
    raw_response_text_for_error = "Function crashed before reaching the AI response stage."

    print(f"Starting analysis for: {file_name}")

    try:
        # --- Set status to ANALYZING for immediate UI feedback ---
        doc_ref = db.collection("sows").document(doc_id)
        doc_ref.update({"status": "ANALYZING"})
        print(f"Set status to ANALYZING for document: {doc_id}")

        # --- Fetch configuration from Firestore ---
        settings_ref = db.collection('settings').document('global_config')
        settings = settings_ref.get().to_dict()
        MODEL_NAME = settings.get('legislative_analysis_model', 'gemini-2.5-pro') # Updated model name
        MODEL_TEMPERATURE = settings.get('analysis_model_temperature', 0.2)
        PROMPT_ID = settings.get('legislative_analysis_prompt_id')

        prompt_ref = db.collection('prompts').document(PROMPT_ID)
        prompt_template = prompt_ref.get().to_dict().get('prompt_text')
        
        vertexai.init(project="state-of-texas-sow-demo", location="us-central1")
        model = GenerativeModel(MODEL_NAME)
        generation_config = GenerationConfig(temperature=float(MODEL_TEMPERATURE))
        
        print(f"Using settings - Model: {MODEL_NAME}, Temp: {MODEL_TEMPERATURE}")

        # --- Download and Chunk Document Text ---
        source_bucket = storage_client.bucket(bucket_name)
        blob = source_bucket.blob(file_name)
        document_text = blob.download_as_text()
        print(f"Downloaded {len(document_text)} characters.")

        chunk_size = 14000
        chunks = [document_text[i:i + chunk_size] for i in range(0, len(document_text), chunk_size)]
        print(f"Split document into {len(chunks)} chunks.")

        all_requirements = []
        
        # --- Analyze Each Chunk ---
        for i, chunk in enumerate(chunks):
            print(f"Processing chunk {i+1}/{len(chunks)}...")
            prompt = prompt_template.replace('{DOCUMENT_TEXT}', chunk)
            response = model.generate_content(prompt, generation_config=generation_config)
            raw_response_text_for_error = response.text
            
            try:
                json_start = response.text.find('{')
                json_end = response.text.rfind('}') + 1
                if json_start != -1 and json_end != 0:
                    json_string = response.text[json_start:json_end]
                    chunk_result = json.loads(json_string)
                    chunk_reqs = chunk_result.get('requirements', [])
                    if isinstance(chunk_reqs, list):
                        all_requirements.extend(chunk_reqs)
                        print(f"  -> Found {len(chunk_reqs)} requirements in chunk {i+1}.")
            except Exception as parse_error:
                print(f"  -> WARNING: Could not parse JSON from chunk {i+1}. Error: {parse_error}")

        print(f"Aggregated a total of {len(all_requirements)} requirements.")

        # --- Create Final Summary ---
        final_summary = "Summary generation from aggregated requirements is pending."
        if all_requirements:
            for i, req in enumerate(all_requirements):
                req['id'] = f"REQ-{i+1:03d}"
            summary_prompt = f"Based on the following list of extracted requirements from a legislative bill, please write a single, concise paragraph that summarizes the overall impact and key responsibilities for the agency.\n\nEXTRACTED REQUIREMENTS JSON:\n{json.dumps(all_requirements, indent=2)}\n\nCONCISE SUMMARY PARAGRAPH:"
            summary_response = model.generate_content(summary_prompt, generation_config=generation_config)
            final_summary = summary_response.text.strip()
        else:
            final_summary = "No specific requirements for the Texas Department of Motor Vehicles were identified."

        # --- Assemble and Save Final Result ---
        final_analysis_result = {
            "summary": final_summary,
            "requirements": all_requirements
        }

        doc_ref.update({
            "status": "ANALYZED_SUCCESS",
            "analysis": final_analysis_result,
            "model_used": MODEL_NAME,
            "prompt_used": PROMPT_ID,
            "temperature_used": float(MODEL_TEMPERATURE),
            "analyzed_at": firestore.SERVER_TIMESTAMP
        })
        print(f"SUCCESS: Saved final analysis for document ID '{doc_id}' to Firestore.")

    except Exception as e:
        tb_str = traceback.format_exc()
        print(f"!!! CRITICAL ERROR in analysis for file '{file_name}':\n--- EXCEPTION ---\n{e}\n--- TRACEBACK ---\n{tb_str}\n")
        doc_ref.set({"status": "ANALYSIS_FAILED", "error_message": str(e), "error_traceback": tb_str}, merge=True)
        print(f"!!! Wrote failure details to Firestore for document ID '{doc_id}'.")