import functions_framework
import os
import json
import logging
import sys
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig, HarmCategory, HarmBlockThreshold
from google.cloud import firestore, storage, documentai
from google.api_core.client_options import ClientOptions

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

db, storage_client, docai_client, global_settings = None, None, None, None

def init_all_clients():
    """Initializes all necessary clients and settings for reuse."""
    global db, storage_client, docai_client, global_settings
    if all((db, storage_client, docai_client, global_settings)):
        return

    logger.info("--- Initializing all clients and loading global_config ---")
    db, storage_client = firestore.Client(), storage.Client()
    settings_doc = db.collection('settings').document('global_config').get()
    if not settings_doc.exists:
        raise Exception("CRITICAL: Global config 'global_config' not found in Firestore!")
    global_settings = settings_doc.to_dict()
    vertexai.init(project=global_settings["gcp_project_id"], location=global_settings["vertex_ai_location"])
    opts = ClientOptions(api_endpoint=f"{global_settings['docai_location']}-documentai.googleapis.com")
    docai_client = documentai.DocumentProcessorServiceClient(client_options=opts)
    logger.info("✅ All services initialized successfully.")

@functions_framework.http
def template_generation_func(request): # CORRECTED NAME
    """Generates a new SOW template from sample documents."""
    try:
        init_all_clients()
    except Exception as e:
        logger.critical(f"!!! CLIENT INITIALIZATION FAILED: {e}", exc_info=True)
        return "Could not initialize backend services.", 500

    try:
        request_json = request.get_json(silent=True)
        sample_files, name = request_json.get('sample_files', []), request_json.get('template_name')
        desc = request_json.get('template_description', '')
        if not sample_files or not name:
            logger.error("Missing 'sample_files' or 'template_name' in request body")
            return "Missing 'sample_files' or 'template_name' in request body", 400
        
        logger.info(f"Generating new template '{name}' from {len(sample_files)} samples.")
        concatenated_text = _extract_text_from_samples(sample_files)
        
        prompt_id = global_settings['template_generation_prompt_id']
        prompt_template = db.collection('prompts').document(prompt_id).get().to_dict().get('prompt_text')
        final_prompt = prompt_template.format(concatenated_text=concatenated_text)

        # 1. Define safety settings
        safety_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        }
        
        # 2. Update the GenerationConfig
        model = GenerativeModel(global_settings['sow_generation_model'])
        config = GenerationConfig(
            temperature=float(global_settings['sow_generation_model_temperature']),
            max_output_tokens=int(global_settings['sow_generation_max_tokens'])
        )

        logger.info("Sending template generation prompt to Vertex AI...")
        # 3. Add safety_settings to the generate_content call
        response = model.generate_content(
            final_prompt,
            generation_config=config,
            safety_settings=safety_settings
        )

        # 4. Add a check for an empty response
        if not response.candidates or not response.candidates[0].content.parts:
            raise ValueError("The template generation model returned an empty response, likely due to safety filters.")
            
        generated_text = response.text.strip().replace("```markdown", "").replace("```", "")
        logger.info("Received generated template from Vertex AI.")
        
        template_id = _save_template(name, desc, generated_text, sample_files)
        logger.info(f"SUCCESS: Saved new template with ID: {template_id}")
        return {'message': 'Template created successfully', 'templateId': template_id}, 200

    except Exception as e:
        logger.critical(f"!!! CRITICAL ERROR: {e}", exc_info=True)
        return f"An error occurred during template generation: {e}", 500

def _extract_text_from_samples(sample_files):
    """Iterates through GCS files, extracts text, and concatenates it."""
    bucket = storage_client.bucket(global_settings['gcs_template_samples_bucket'])
    processor_path = docai_client.processor_path(
        global_settings["gcp_project_id"],
        global_settings["docai_location"],
        global_settings["docai_processor_id"]
    )
    texts = []
    
    for file_path in sample_files:
        logger.info(f"  -> Processing sample: {file_path}")
        blob = bucket.blob(file_path)
        
        if file_path.lower().endswith('.pdf'):
            # --- THIS IS THE FIX ---
            # 1. Download the PDF content from GCS into memory as bytes.
            pdf_bytes = blob.download_as_bytes()
            
            # 2. Create a RawDocument object with the bytes.
            raw_doc = documentai.RawDocument(content=pdf_bytes, mime_type="application/pdf")
            
            # 3. Call process_document with the 'raw_document' parameter.
            request = documentai.ProcessRequest(name=processor_path, raw_document=raw_doc)
            result = docai_client.process_document(request=request)
            texts.append(result.document.text)
            logger.info(f"     ...extracted text from PDF using Document AI.")
        else:
            # Text files can be read directly.
            texts.append(blob.download_as_text())
            logger.info(f"     ...read text directly.")
            
    return "\n\n--- SAMPLE DOCUMENT ---\n".join(texts)

def _save_template(name, desc, content, samples):
    bucket = storage_client.bucket(global_settings['gcs_templates_bucket'])
    template_id = name.lower().replace(' ', '_').replace('/', '_') + f"_{os.urandom(4).hex()}"
    gcs_path = f"{template_id}.md"
    bucket.blob(gcs_path).upload_from_string(content)
    db.collection('templates').document(template_id).set({
        'name': name, 'description': desc, 'gcs_path': gcs_path,
        'created_at': firestore.SERVER_TIMESTAMP, 'source_samples': samples
    })
    return template_id
