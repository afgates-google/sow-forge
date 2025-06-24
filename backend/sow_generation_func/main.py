import functions_framework
import os
import json

@functions_framework.http
def generate_sow(request):
    """
    An HTTP-triggered function to generate a draft SOW.
    It dynamically fetches all its configuration (model, tuning parameters,
    prompts, and content formats) from Firestore before execution.
    """
    # --- Import heavy libraries inside the function ---
    from google.cloud import firestore, storage
    import vertexai
    from vertexai.generative_models import GenerativeModel, GenerationConfig

    print("SOW Generation function triggered.")

    try:
        # --- 1. Initialize DB client ---
        db = firestore.Client()

        # --- 2. Fetch Global Settings from Firestore ---
        settings_ref = db.collection('settings').document('global_config')
        settings_doc = settings_ref.get()
        if not settings_doc.exists:
            raise Exception("Critical Error: Global settings document 'global_config' not found.")
        
        settings = settings_doc.to_dict()
        
        # Get all configuration from settings, with reasonable fallbacks
        MODEL_NAME = settings.get('sow_generation_model', 'gemini-2.5-pro')
        MODEL_TEMPERATURE = settings.get('sow_generation_model_temperature', 0.4)
        MAX_OUTPUT_TOKENS = settings.get('sow_generation_max_tokens', 4096)
        PROMPT_ID = settings.get('sow_generation_prompt_id')
        SOW_TITLE_PREFIX = settings.get('sow_title_prefix', 'SOW Draft for')
        AI_REVIEW_TAG = settings.get('ai_review_tag_format', '[DRAFT-AI: {content}]')

        if not PROMPT_ID:
            raise Exception("Setting 'sow_generation_prompt_id' not found in Firestore.")
            
        print(f"Using settings - Model: {MODEL_NAME}, Temp: {MODEL_TEMPERATURE}, Prompt ID: {PROMPT_ID}")

        # --- 3. Fetch the AI Prompt Text from Firestore ---
        prompt_ref = db.collection('prompts').document(PROMPT_ID)
        prompt_doc = prompt_ref.get()
        if not prompt_doc.exists:
            raise Exception(f"Prompt document '{PROMPT_ID}' not found in 'prompts' collection.")
            
        prompt_template = prompt_doc.to_dict().get('prompt_text')
        if not prompt_template:
            raise Exception(f"Prompt document '{PROMPT_ID}' is missing the 'prompt_text' field.")

        # --- Initialize other clients and get request data ---
        storage_client = storage.Client()
        vertexai.init(project="state-of-texas-sow-demo", location="us-central1")
        model = GenerativeModel(MODEL_NAME)
        print("Services initialized successfully.")

        request_json = request.get_json(silent=True)
        if not request_json or 'docId' not in request_json or 'templateId' not in request_json:
            return ("Missing 'docId' or 'templateId' in request body", 400)
        
        doc_id = request_json['docId']
        template_id = request_json['templateId']
        print(f"Processing docId: '{doc_id}', templateId: '{template_id}'")

        # --- Fetch all necessary data ---
        sow_doc_ref = db.collection('sows').document(doc_id)
        sow_doc = sow_doc_ref.get()
        if not sow_doc.exists:
            return (f"Document with ID {doc_id} not found in 'sows' collection.", 404)
        analysis_data = sow_doc.to_dict().get('analysis', {})

        template_doc = db.collection('templates').document(template_id).get()
        if not template_doc.exists:
            return (f"Template with ID {template_id} not found.", 404)
        template_path = template_doc.to_dict().get('gcs_path')

        bucket = storage_client.bucket('sow-forge-texas-dmv-templates')
        blob = bucket.blob(template_path)
        template_content = blob.download_as_text()
        print(f"Successfully fetched all required data.")

        # --- 4. Format the fetched prompt template with the data ---
        project_name = f"{SOW_TITLE_PREFIX} {doc_id}"
        
        prompt = prompt_template
        
        prompt = prompt.replace('{template_content}', template_content)
        prompt = prompt.replace('{analysis_data_json}', json.dumps(analysis_data, indent=2))
        prompt = prompt.replace('{original_filename}', f"{doc_id}.pdf")
        prompt = prompt.replace('{project_name_placeholder}', project_name)
        prompt = prompt.replace('{ai_review_tag}', AI_REVIEW_TAG)

        # --- 5. Call the AI model with the configured parameters ---
        generation_config = GenerationConfig(
            temperature=float(MODEL_TEMPERATURE),
            max_output_tokens=int(MAX_OUTPUT_TOKENS)
        )

        print(f"Sending merge prompt to Vertex AI...")
        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )
        generated_sow_text = response.text.strip().replace("```markdown", "").replace("```", "")
        print("Received merged SOW from Vertex AI.")

        # --- 6. Save the generated SOW back to Firestore ---
        sow_doc_ref.update({
            'generated_sow': generated_sow_text,
            'status': 'SOW_GENERATED',
            'model_used_for_sow': MODEL_NAME,
            'prompt_used_for_sow': PROMPT_ID,
            'sow_gen_temp_used': float(MODEL_TEMPERATURE)
        })
        print("Successfully saved generated SOW to Firestore.")

        # 7. Return the generated SOW text as the HTTP response
        return (generated_sow_text, 200, {'Content-Type': 'text/plain; charset=utf-8'})

    except Exception as e:
        print(f"!!! CRITICAL ERROR during SOW generation: {e}")
        return (f"An error occurred: {e}", 500)