import functions_framework
import os
import json
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
from google.cloud import firestore, storage
import traceback

# --- Initialize clients in the global scope for reuse ---
db = firestore.Client()
storage_client = storage.Client()

@functions_framework.http
def generate_sow(request):
    """
    An HTTP-triggered function to generate a draft SOW from a SOW Project.
    --- MODIFIED: This function now aggregates analysis from multiple source documents. ---
    """
    print("SOW Generation function triggered for a project.")

    project_ref = None # Define here for the except block

    try:
        # --- 1. Fetch Global Settings & Request Data ---
        settings_ref = db.collection('settings').document('global_config')
        settings = settings_ref.get().to_dict()

        # --- NEW: Initialize Vertex AI with settings from Firestore ---
        GCP_PROJECT_ID = settings.get("gcp_project_id")
        VERTEX_AI_LOCATION = settings.get("vertex_ai_location")
        vertexai.init(project=GCP_PROJECT_ID, location=VERTEX_AI_LOCATION)
        
        MODEL_NAME = settings.get('sow_generation_model', 'gemini-1.5-pro')
        MODEL_TEMPERATURE = settings.get('sow_generation_model_temperature', 0.4)
        MAX_OUTPUT_TOKENS = int(settings.get('sow_generation_max_tokens', 8192))
        PROMPT_ID = settings.get('sow_generation_prompt_id')
        SOW_TITLE_PREFIX = settings.get('sow_title_prefix', 'SOW Draft for')
        AI_REVIEW_TAG = settings.get('ai_review_tag_format', '[DRAFT-AI: {content}]')
        TEMPLATE_BUCKET_NAME = settings.get('gcs_templates_bucket')

        request_json = request.get_json(silent=True)
        if not request_json or 'projectId' not in request_json or 'templateId' not in request_json:
            return ("Missing 'projectId' or 'templateId' in request body", 400)
        
        project_id = request_json['projectId']
        template_id = request_json['templateId']
        project_ref = db.collection('sow_projects').document(project_id)
        
        print(f"Processing projectId: '{project_id}', templateId: '{template_id}'")

        # --- 2. Fetch ALL source documents and their analyses ---
        source_docs_snapshot = project_ref.collection('source_documents').stream()
        
        all_requirements = []
        all_summaries = []
        
        for doc in source_docs_snapshot:
            doc_data = doc.to_dict()
            if doc_data.get('status') == 'ANALYZED_SUCCESS':
                analysis = doc_data.get('analysis', {})
                for req in analysis.get('requirements', []):
                    req['source_file'] = doc_data.get('originalFilename', 'Unknown')
                    all_requirements.append(req)
                
                all_summaries.append({
                    "filename": doc_data.get('originalFilename', 'Unknown'),
                    "category": doc_data.get('category', 'General'),
                    "summary": analysis.get('summary', '')
                })

        if not all_summaries:
            project_ref.update({'status': 'SOW_GENERATION_FAILED', 'error_message': 'No successfully analyzed documents found in this project.'})
            return ("No successfully analyzed documents found in this project.", 400)
        
        print(f"Aggregated {len(all_requirements)} requirements from {len(all_summaries)} documents.")

        # --- 3. Perform a "Meta-Summary" AI call ---
        model = GenerativeModel(MODEL_NAME) # <-- CORRECTED USAGE
        meta_summary_prompt = f"""
        You are a senior project lead. You have received summaries from multiple source documents for an upcoming Statement of Work. Your task is to synthesize these individual summaries into a single, cohesive, high-level project overview. This overview should explain the project's overall goal and the role of the different document types.

        INDIVIDUAL SUMMARIES:
        {json.dumps(all_summaries, indent=2)}

        Synthesize these into a single, comprehensive project overview paragraph.
        """
        meta_summary_response = model.generate_content(meta_summary_prompt)
        project_meta_summary = meta_summary_response.text.strip()
        print("Generated project meta-summary.")

        # --- 4. Assemble the final aggregated data object ---
        aggregated_analysis = {
            "project_overview": project_meta_summary,
            "all_requirements": all_requirements
        }

        # --- 5. Fetch Template and Final SOW Prompt ---
        template_doc = db.collection('templates').document(template_id).get()
        template_path = template_doc.to_dict().get('gcs_path')
        blob = storage_client.bucket(TEMPLATE_BUCKET_NAME).blob(template_path)
        template_content = blob.download_as_text()

        prompt_ref = db.collection('prompts').document(PROMPT_ID)
        prompt_template = prompt_ref.get().to_dict().get('prompt_text')

        # --- 6. Format the Final Prompt ---
        project_data = project_ref.get().to_dict()
        project_name = f"{SOW_TITLE_PREFIX} {project_data.get('projectName', 'Untitled Project')}"
        
        prompt = prompt_template.replace('{template_content}', template_content)
        prompt = prompt.replace('{aggregated_analysis_json}', json.dumps(aggregated_analysis, indent=2))
        prompt = prompt.replace('{project_name_placeholder}', project_name)
        prompt = prompt.replace('{ai_review_tag}', AI_REVIEW_TAG)
        
        # --- 7. Call AI to Generate Final SOW ---
        generation_config = GenerationConfig(
            temperature=float(MODEL_TEMPERATURE),
            max_output_tokens=MAX_OUTPUT_TOKENS
        )
        print("Sending final merge prompt to Vertex AI...")
        response = model.generate_content(prompt, generation_config=generation_config)
        generated_sow_text = response.text.strip().replace("```markdown", "").replace("```", "")
        print("Received final merged SOW from Vertex AI.")

        # --- 8. Save Generated SOW to the MAIN Project Document ---
        project_ref.update({
            'generatedSowText': generated_sow_text,
            'status': 'SOW_GENERATED',
            'model_used_for_sow': MODEL_NAME,
            'prompt_used_for_sow': PROMPT_ID,
            'sow_gen_temp_used': float(MODEL_TEMPERATURE)
        })
        print(f"Successfully saved final SOW to project '{project_id}'.")

        return (generated_sow_text, 200, {'Content-Type': 'text/plain; charset=utf-8'})

    except Exception as e:
        tb_str = traceback.format_exc()
        error_message = f"!!! CRITICAL ERROR during SOW generation: {e}\n{tb_str}"
        print(error_message)
        if project_ref:
            project_ref.update({'status': 'SOW_GENERATION_FAILED', 'error_message': error_message})
        return (f"An error occurred: {e}", 500)