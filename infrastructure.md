Google Cloud Storage Buckets	
sow-forge-texas-dmv-batch-output

sow-forge-texas-dmv-functions-source

sow-forge-texas-dmv-processed-text

sow-forge-texas-dmv-template-samples

sow-forge-texas-dmv-templates

sow-forge-texas-dmv-uploads

state-of-texas-sow-demo_cloudbuild

Firestore Collections
global_config
gcs_templates_bucket: "sow-forge-texas-dmv-templates"
(string) 
gcs_uploads_bucket: "sow-forge-state-of-texas-sow-demo-uploads"
(string) 
google_docs_base_url: "https://docs.google.com/document/d/"
(string) 
legislative_analysis_model: "gemini-2.5-flash"
(string) 
meta_summary_prompt_id: "meta_summary_prompt"
(string) 
prompt_mapping
(map) 
sow_generation_func_url: "https://sow-generation-func-zaolvsfwta-uc.a.run.app"
(string) 
sow_generation_max_tokens: 8192
(number) 
sow_generation_model: "gemini-2.5-flash"
(string) 
sow_generation_model_temperature: 0.4
(number) 
sow_generation_prompt_id: "sow_generation_default"
(string) 
sow_title_prefix: "SOW Draft for"
(string) 
sync_page_limit: 15
(number) 
template_generation_func_url: "https://template-generation-func-zaolvsfwta-uc.a.run.app"
(string) 
vertex_ai_location: "us-central1"
(string) 
vertex_ai_safety_threshold: "BLOCK_ONLY_HIGH"

Document AI Processor ID d64449d9cff40bf1

Project ID state-of-texas-sow-demo