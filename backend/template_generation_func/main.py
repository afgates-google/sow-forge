import functions_framework
import os
import json
from google.cloud import firestore, storage, documentai
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
# --- FIX #1: Import the necessary libraries ---
from google.api_core.client_options import ClientOptions
import traceback

@functions_framework.http
def generate_template(request):
    """
    A powerful, single HTTP-triggered function that generates a new SOW template.
    """
    print("Template Generation v2 function triggered.")
    
    db = firestore.Client()
    storage_client = storage.Client()
    
    try:
        # --- Fetch Global Settings for AI configuration ---
        settings_ref = db.collection('settings').document('global_config')
        settings = settings_ref.get().to_dict()
        
        MODEL_NAME = settings.get('sow_generation_model', 'text-bison@002')
        MODEL_TEMPERATURE = settings.get('sow_generation_model_temperature', 0.4)
        MAX_OUTPUT_TOKENS = int(settings.get('sow_generation_max_tokens', 4096))
        
        GCP_PROJECT_NUMBER = settings.get("gcp_project_number")
        DOCAI_PROCESSOR_ID = settings.get("docai_processor_id")
        DOCAI_LOCATION = settings.get("docai_location", "us")

        if not all([GCP_PROJECT_NUMBER, DOCAI_PROCESSOR_ID, DOCAI_LOCATION]):
            raise Exception("Required Document AI settings are missing from Firestore.")

        # --- Initialize AI clients ---
        vertexai.init(project="state-of-texas-sow-demo", location="us-central1")
        model = GenerativeModel(MODEL_NAME)
        generation_config = GenerationConfig(temperature=float(MODEL_TEMPERATURE), max_output_tokens=MAX_OUTPUT_TOKENS)
        
        # --- FIX #2: Correctly initialize the Document AI client ---
        opts = ClientOptions(api_endpoint=f"{DOCAI_LOCATION}-documentai.googleapis.com")
        docai_client = documentai.DocumentProcessorServiceClient(client_options=opts)
        PROCESSOR_PATH = f"projects/{GCP_PROJECT_NUMBER}/locations/{DOCAI_LOCATION}/processors/{DOCAI_PROCESSOR_ID}"

        print(f"Using Model: {MODEL_NAME}, Temp: {MODEL_TEMPERATURE}")

        # --- Get inputs from the HTTP request ---
        request_json = request.get_json(silent=True)
        sample_files = request_json.get('sample_files', [])
        template_name = request_json.get('template_name')
        template_desc = request_json.get('template_description', '')

        if not sample_files or not template_name:
            return ("Missing 'sample_files' or 'template_name' in request body", 400)
        
        print(f"Generating new template '{template_name}' from {len(sample_files)} samples.")

        # --- Extract text from all sample files ---
        concatenated_text = ""
        sample_bucket = storage_client.bucket('sow-forge-texas-dmv-template-samples')
        
        for file_path in sample_files:
            print(f"Processing sample: {file_path}")
            blob = sample_bucket.blob(file_path)
            
            if file_path.lower().endswith('.pdf'):
                gcs_uri = f"gs://{sample_bucket.name}/{file_path}"
                gcs_document = documentai.GcsDocument(gcs_uri=gcs_uri, mime_type="application/pdf")
                # Using simple sync processing for template samples
                docai_request = documentai.ProcessRequest(name=PROCESSOR_PATH, gcs_document=gcs_document)
                result = docai_client.process_document(request=docai_request)
                file_content = result.document.text
                print(f"  -> Extracted text from PDF using Document AI.")
            else:
                file_content = blob.download_as_text()
                print(f"  -> Read text directly.")
            
            concatenated_text += f"\n\n--- SAMPLE DOCUMENT: {file_path} ---\n{file_content}"
        
        print(f"Extracted a total of {len(concatenated_text)} characters.")

        # --- Fetch the template generation prompt from Firestore ---
        # NOTE: You must create this 'template_generation_default' document in your 'prompts' collection.
        prompt_ref = db.collection('prompts').document('template_generation_default')
        prompt_doc = prompt_ref.get()
        if not prompt_doc.exists:
            raise Exception("Prompt 'template_generation_default' not found in Firestore.")

        prompt_template = prompt_doc.to_dict().get('prompt_text')
        prompt = prompt_template.format(concatenated_text=concatenated_text)

        # --- Call the AI model ---
        print("Sending template generation prompt to Vertex AI...")
        response = model.generate_content(prompt, generation_config=generation_config)
        generated_template_text = response.text.strip().replace("```markdown", "").replace("```", "")
        print("Received generated template from Vertex AI.")

        # --- Save the new template to GCS and Firestore ---
        template_id = template_name.lower().replace(' ', '_') + f"_{os.urandom(4).hex()}"
        template_gcs_path = f"{template_id}.md"

        template_bucket = storage_client.bucket('sow-forge-texas-dmv-templates')
        template_blob = template_bucket.blob(template_gcs_path)
        template_blob.upload_from_string(generated_template_text)

        template_ref = db.collection('templates').document(template_id)
        template_ref.set({'name': template_name, 'description': template_desc, 'gcs_path': template_gcs_path, 'created_at': firestore.SERVER_TIMESTAMP, 'source_samples': sample_files})
        
        print(f"SUCCESS: Saved new template to Firestore with ID: {template_id}")

        return ({'message': 'Template created successfully', 'templateId': template_id}, 200)

    except Exception as e:
        # --- FIX #3: The traceback logging will now work correctly ---
        tb_str = traceback.format_exc()
        print(f"!!! CRITICAL ERROR during template generation: {e}\n--- TRACEBACK ---\n{tb_str}")
        return (f"An error occurred: {e}", 500)