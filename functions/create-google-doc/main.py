import functions_framework
import logging
import sys
from googleapiclient.discovery import build
import functions_framework
import logging
import sys
import os
import json
from googleapiclient.discovery import build
from google.auth import credentials
from google.cloud import firestore
from google.cloud import secretmanager

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

db = None
service = None
global_settings = None

def get_credentials():
    """Gets credentials from Secret Manager or application default."""
    if os.getenv('GAE_ENV', '').startswith('standard'):
        # Production environment
        creds, _ = default()
        return creds
    else:
        # Local development
        secret_client = secretmanager.SecretManagerServiceClient()
        secret_name = f"projects/{os.getenv('GCLOUD_PROJECT')}/secrets/sow-forge-sa-key/versions/latest"
        response = secret_client.access_secret_version(name=secret_name)
        secret_payload = response.payload.data.decode('UTF-8')
        creds_info = json.loads(secret_payload)
        return credentials.Credentials.from_authorized_user_info(creds_info)

def init_clients_and_service():
    """Initializes global clients and the Google Docs service object."""
    global db, service, global_settings
    if all((db, service, global_settings)):
        return

    logger.info("--- Initializing clients and Google Docs service ---")
    
    creds = get_credentials()
    db = firestore.Client(credentials=creds)
    
    settings_doc = db.collection('settings').document('global_config').get()
    if not settings_doc.exists:
        raise Exception("CRITICAL: Global config 'global_config' not found in Firestore!")
    global_settings = settings_doc.to_dict()

    SCOPES = global_settings.get('google_docs_api_scopes', 'https://www.googleapis.com/auth/documents').split(',')
    DELEGATED_ADMIN_EMAIL = global_settings.get('gsuite_delegated_admin_email')
    
    scoped_creds = creds.with_scopes(SCOPES)
    if DELEGATED_ADMIN_EMAIL:
        scoped_creds = scoped_creds.with_subject(DELEGATED_ADMIN_EMAIL)
        
    service = build('docs', 'v1', credentials=scoped_creds)
    logger.info("✅ Google Docs service initialized and cached successfully.")


@functions_framework.http
def create_google_doc(request):
    try:
        init_clients_and_service()
    except Exception as e:
        logger.critical(f"!!! CLIENT INITIALIZATION FAILED: {e}", exc_info=True)
        return "Could not initialize backend services.", 500
    try:
        request_json = request.get_json(silent=True)
        project_id = request_json.get('projectId')
        sow_id = request_json.get('sowId') # <-- NEW: Get the specific SOW ID

        if not all([project_id, sow_id]):
            logger.error("Missing 'projectId' or 'sowId' in request body")
            return "Missing 'projectId' or 'sowId' in request body", 400

        logger.info(f"--- Create Google Doc for SOW: {sow_id} in project: {project_id} ---")

        # Reference the specific SOW document
        sow_ref = db.collection('sow_projects').document(project_id).collection('generated_sow').document(sow_id)
        sow_data = sow_ref.get().to_dict()

        sow_text = sow_data.get('generatedSowText', '# Error: SOW Text Not Found')
        project_name = db.collection('sow_projects').document(project_id).get().to_dict().get('projectName')
        sow_title = f"SOW for {project_name} (using {sow_data.get('templateName', 'template')})"
        
        body = {'title': sow_title, 'body': {'content': [{'paragraph': {'elements': [{'textRun': {'content': sow_text}}]}}]}}
        doc = service.documents().create(body=body).execute()
        
        # Use a configurable base URL for the document
        doc_base_url = global_settings.get('google_docs_base_url', 'https://docs.google.com/document/d/')
        doc_url = f"{doc_base_url}{doc['documentId']}/edit"
        
        # Update the specific SOW document with the URL
        sow_ref.update({'googleDocUrl': doc_url})

        logger.info(f"Successfully created Google Doc: {doc_url}")
        return {'doc_url': doc_url, 'sowId': sow_id}, 200
        
    except Exception as e:
        logger.critical("!!! CRITICAL ERROR during Google Doc creation", exc_info=True)
        return "An error occurred while creating the Google Doc.", 500
