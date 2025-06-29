import functions_framework
import os
import json
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
from google.cloud import firestore, storage
import traceback

# --- (1) NEW: Global variables for all clients and settings ---
db = None
storage_client = None
global_settings = None

def init_clients_and_settings():
    """Initializes global clients and settings to reuse connections."""
    global db, storage_client, global_settings
    if all([db, storage_client, global_settings]):
        return # Already initialized

    print("--- Initializing clients and loading global_config ---")
    db = firestore.Client()
    storage_client = storage.Client()
    
    settings_doc = db.collection('settings').document('global_config').get()
    if not settings_doc.exists:
        raise Exception("CRITICAL: Global config 'global_config' not found in Firestore!")
    
    global_settings = settings_doc.to_dict()
    
    vertexai.init(
        project=global_settings["gcp_project_id"],
        location=global_settings["vertex_ai_location"]
    )
    print("✅ All clients, settings, and Vertex AI initialized successfully.")


@functions_framework.http
def generate_sow(request):
    """
    An HTTP-triggered function to generate a draft SOW by aggregating analysis
    from multiple source documents within a project.
    """
    # --- (2) NEW: Initialize clients and settings on invocation ---
    try:
        init_clients_and_settings()
    except Exception as e:
        print(f"!!! CLIENT INITIALIZATION FAILED: {e}")
        return ("Could not initialize backend services.", 500)

    project_ref = None

    try:
        # 1. Get request data
        request_json = request.get_json(silent=True)
        if not request_json or 'projectId' not in request_json or 'templateId' not in request_json:
            return ("Missing 'projectId' or 'templateId' in request body", 400)
        
        project_id = request_json['projectId']
        template_id = request_json['templateId']
        project_ref = db.collection('sow_projects').document(project_id)
        print(f"--- SOW Generation triggered for project: {project_id}, template: {template_id} ---")

        # 2. Aggregate all successful analyses from source documents
        all_requirements, all_summaries = _aggregate_analyses(project_ref)
        if not all_summaries:
            project_ref.update({'status': 'SOW_GENERATION_FAILED', 'error_message': 'No successfully analyzed documents found.'})
            return ("No successfully analyzed documents found in this project.", 400)
        
        # 3. Use AI to create a "meta-summary" of the project
        model = GenerativeModel(global_settings['sow_generation_model'])
        project_meta_summary = _create_meta_summary(model, all_summaries)
        
        aggregated_analysis = {
            "project_overview": project_meta_summary,
            "all_requirements": all_requirements
        }

        # 4. Fetch the SOW template and the final generation prompt
        template_content = _get_gcs_content(
            global_settings['gcs_templates_bucket'],
            _get_firestore_doc_property(db.collection('templates').document(template_id), 'gcs_path')
        )
        sow_prompt_template = _get_firestore_doc_property(
            db.collection('prompts').document(global_settings['sow_generation_prompt_id']),
            'prompt_text'
        )

        # 5. Assemble the final prompt and generate the SOW
        project_name = _get_firestore_doc_property(project_ref, 'projectName', 'Untitled Project')
        final_prompt = _assemble_final_prompt(sow_prompt_template, template_content, aggregated_analysis, project_name)
        
        generation_config = GenerationConfig(
            temperature=float(global_settings['sow_generation_model_temperature']),
            max_output_tokens=int(global_settings['sow_generation_max_tokens'])
        )
        print("Sending final merge prompt to Vertex AI...")
        response = model.generate_content(final_prompt, generation_config=generation_config)
        generated_sow_text = response.text.strip().replace("```markdown", "").replace("```", "")
        print("Received final merged SOW from Vertex AI.")

        # 6. Save the final SOW and update the project status
        project_ref.update({
            'generatedSowText': generated_sow_text,
            'status': 'SOW_GENERATED',
            'model_used_for_sow': global_settings['sow_generation_model'],
            'prompt_used_for_sow': global_settings['sow_generation_prompt_id'],
        })
        print(f"SUCCESS: Saved final SOW to project '{project_id}'.")

        return (generated_sow_text, 200, {'Content-Type': 'text/plain; charset=utf-8'})

    except Exception as e:
        tb_str = traceback.format_exc()
        error_message = f"!!! CRITICAL ERROR during SOW generation: {e}\n{tb_str}"
        print(error_message)
        if project_ref:
            project_ref.update({'status': 'SOW_GENERATION_FAILED', 'error_message': error_message})
        return ("An error occurred during SOW generation.", 500)

# --- (3) NEW: Helper functions for clarity and testability ---
def _aggregate_analyses(project_ref):
    """Gathers all requirements and summaries from successfully analyzed documents."""
    source_docs_snapshot = project_ref.collection('source_documents').where('status', '==', 'ANALYZED_SUCCESS').stream()
    all_reqs, all_sums = [], []
    for doc in source_docs_snapshot:
        doc_data = doc.to_dict()
        analysis = doc_data.get('analysis', {})
        for req in analysis.get('requirements', []):
            req['source_file'] = doc_data.get('originalFilename', 'Unknown')
            all_reqs.append(req)
        all_sums.append({
            "filename": doc_data.get('originalFilename', 'Unknown'),
            "category": doc_data.get('category', 'General'),
            "summary": analysis.get('summary', '')
        })
    print(f"Aggregated {len(all_reqs)} requirements from {len(all_sums)} documents.")
    return all_reqs, all_sums

def _create_meta_summary(model, summaries):
    """Uses an AI call to create a synthesized overview from individual summaries."""
    print("Generating project meta-summary...")
    prompt = f"""You are a senior project lead. You have received summaries from multiple source documents for an upcoming Statement of Work. Your task is to synthesize these individual summaries into a single, cohesive, high-level project overview. This overview should explain the project's overall goal and the role of the different document types.

    INDIVIDUAL SUMMARIES:
    {json.dumps(summaries, indent=2)}

    Synthesize these into a single, comprehensive project overview paragraph."""
    response = model.generate_content(prompt)
    return response.text.strip()

def _get_firestore_doc_property(doc_ref, prop_name, default=None):
    """Safely gets a property from a Firestore document."""
    doc = doc_ref.get()
    if not doc.exists:
        raise ValueError(f"Document {doc_ref.path} not found.")
    return doc.to_dict().get(prop_name, default)

def _get_gcs_content(bucket_name, file_path):
    """Safely gets content of a file from GCS."""
    if not file_path:
        raise ValueError("GCS file path is missing in template metadata.")
    blob = storage_client.bucket(bucket_name).blob(file_path)
    return blob.download_as_text()

def _assemble_final_prompt(prompt_template, template_content, aggregated_analysis, project_name):
    """Replaces all placeholders in the main SOW generation prompt."""
    sow_title = f"{global_settings.get('sow_title_prefix', 'SOW Draft for')} {project_name}"
    ai_review_tag = global_settings.get('ai_review_tag_format', '[DRAFT-AI: {content}]')
    
    prompt = prompt_template.replace('{template_content}', template_content)
    prompt = prompt.replace('{aggregated_analysis_json}', json.dumps(aggregated_analysis, indent=2))
    prompt = prompt.replace('{project_name_placeholder}', sow_title)
    prompt = prompt.replace('{ai_review_tag}', ai_review_tag)
    return prompt
