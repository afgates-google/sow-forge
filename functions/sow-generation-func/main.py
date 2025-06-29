import functions_framework
import os
import json
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
from google.cloud import firestore, storage
import traceback

db = None
storage_client = None
global_settings = None

def init_clients_and_settings():
    """Initializes global clients and settings to reuse connections."""
    global db, storage_client, global_settings
    if all((db, storage_client, global_settings)):
        return

    print("--- Initializing clients and loading global_config ---")
    db = firestore.Client()
    storage_client = storage.Client()
    settings_doc = db.collection('settings').document('global_config').get()
    if not settings_doc.exists:
        raise Exception("CRITICAL: Global config 'global_config' not found in Firestore!")
    global_settings = settings_doc.to_dict()
    vertexai.init(project=global_settings["gcp_project_id"], location=global_settings["vertex_ai_location"])
    print("✅ All clients, settings, and Vertex AI initialized successfully.")

@functions_framework.http
def sow_generation_func(request):
    """
    Generates a draft SOW and saves it as a NEW document in a sub-collection.
    """
    try:
        init_clients_and_settings()
    except Exception as e:
        print(f"!!! CLIENT INITIALIZATION FAILED: {e}")
        return "Could not initialize backend services.", 500

    project_ref = None
    try:
        request_json = request.get_json(silent=True)
        project_id = request_json.get('projectId')
        template_id = request_json.get('templateId')

        if not all([project_id, template_id]):
            return "Missing 'projectId' or 'templateId' in request body", 400
        
        project_ref = db.collection('sow_projects').document(project_id)
        print(f"--- SOW Generation for project: {project_id}, template: {template_id} ---")

        all_requirements, all_summaries = _aggregate_analyses(project_ref)
        if not all_summaries:
            project_ref.update({'status': 'SOW_GENERATION_FAILED', 'error_message': 'No successfully analyzed documents found.'})
            return "No successfully analyzed documents found.", 400

        model = GenerativeModel(global_settings['sow_generation_model'])
        aggregated_analysis = {
            "project_overview": _create_meta_summary(model, all_summaries),
            "all_requirements": all_requirements
        }

        template_doc = db.collection('templates').document(template_id).get()
        template_name = template_doc.to_dict().get('name', 'Unknown Template')
        template_content = _get_gcs_content(global_settings['gcs_templates_bucket'], template_doc.to_dict().get('gcs_path'))

        sow_prompt_template = _get_firestore_prop(db.collection('prompts').document(global_settings['sow_generation_prompt_id']), 'prompt_text')
        project_name = _get_firestore_prop(project_ref, 'projectName', 'Untitled Project')
        final_prompt = _assemble_final_prompt(sow_prompt_template, template_content, aggregated_analysis, project_name)
        
        config = GenerationConfig(temperature=float(global_settings['sow_generation_model_temperature']), max_output_tokens=int(global_settings['sow_generation_max_tokens']))
        response = model.generate_content(final_prompt, generation_config=config)
        generated_sow_text = response.text.strip().replace("```markdown", "").replace("```", "")

        new_sow_ref = project_ref.collection('generated_sow').document()
        new_sow_ref.set({
            'createdAt': firestore.SERVER_TIMESTAMP,
            'templateId': template_id,
            'templateName': template_name,
            'generatedSowText': generated_sow_text
        })

        project_ref.update({'status': 'SOW_GENERATED'})
        
        print(f"SUCCESS: Saved new SOW with ID '{new_sow_ref.id}' to project '{project_id}'.")
        return {'message': 'SOW generated successfully', 'sowId': new_sow_ref.id}, 200

    except Exception as e:
        tb_str = traceback.format_exc()
        error_message = f"!!! CRITICAL ERROR during SOW generation: {e}\n{tb_str}"
        print(error_message)
        if project_ref:
            project_ref.update({'status': 'SOW_GENERATION_FAILED', 'error_message': error_message})
        return "An error occurred during SOW generation.", 500

def _aggregate_analyses(project_ref):
    docs = project_ref.collection('source_documents').where('status', '==', 'ANALYZED_SUCCESS').stream()
    reqs, sums = [], []
    for doc in docs:
        data = doc.to_dict()
        analysis = data.get('analysis', {})
        for req in analysis.get('requirements', []):
            req['source_file'] = data.get('originalFilename', 'Unknown')
            reqs.append(req)
        sums.append({"filename": data.get('originalFilename', 'Unknown'), "summary": analysis.get('summary', '')})
    return reqs, sums

def _create_meta_summary(model, summaries):
    prompt = f"Synthesize these individual document summaries into a single, cohesive project overview paragraph:\n\n{json.dumps(summaries, indent=2)}"
    return model.generate_content(prompt).text.strip()

def _get_firestore_prop(doc_ref, prop, default=None):
    doc = doc_ref.get()
    if not doc.exists: raise ValueError(f"Document {doc_ref.path} not found.")
    return doc.to_dict().get(prop, default)

def _get_gcs_content(bucket, path):
    if not path: raise ValueError("GCS path missing in metadata.")
    return storage_client.bucket(bucket).blob(path).download_as_text()

def _assemble_final_prompt(template, content, analysis, name):
    title = f"{global_settings.get('sow_title_prefix', 'SOW Draft for')} {name}"
    prompt = template.replace('{template_content}', content)
    prompt = prompt.replace('{aggregated_analysis_json}', json.dumps(analysis, indent=2))
    prompt = prompt.replace('{project_name_placeholder}', title)
    return prompt