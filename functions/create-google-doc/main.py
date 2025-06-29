import functions_framework
from google.cloud import firestore
from googleapiclient.discovery import build
from google.auth import default

# --- Global variables for clients, settings, and the service object ---
db = None
service = None
global_settings = None

def init_clients_and_service():
    """
    Initializes global clients and the Google Docs service object.
    This function is called once per container instance to reuse connections and settings.
    """
    global db, service, global_settings
    if db and service and global_settings:
        return # Already initialized

    print("--- Initializing clients and Google Docs service ---")
    db = firestore.Client()
    
    # 1. Load all configuration from Firestore
    settings_doc = db.collection('settings').document('global_config').get()
    if not settings_doc.exists:
        raise Exception("CRITICAL: Global config 'global_config' not found in Firestore!")
    
    global_settings = settings_doc.to_dict()

    # 2. Prepare credentials for the Google Docs API
    SCOPES = global_settings.get('google_docs_api_scopes', 'https://www.googleapis.com/auth/documents').split(',')
    DELEGATED_ADMIN_EMAIL = global_settings.get('gsuite_delegated_admin_email')

    # Use the function's own identity credentials (no key file needed)
    creds, _ = default(scopes=SCOPES)
    
    # If a delegated admin is specified, create new credentials to impersonate that user
    if DELEGATED_ADMIN_EMAIL:
        creds = creds.with_subject(DELEGATED_ADMIN_EMAIL)
        print(f"Impersonating G-Suite user: {DELEGATED_ADMIN_EMAIL}")

    # 3. Build and cache the service object
    service = build('docs', 'v1', credentials=creds)
    print("✅ Google Docs service initialized and cached successfully.")


@functions_framework.http
def create_doc(request):
    """
    Creates a Google Doc using a pre-initialized and cached service object.
    """
    try:
        init_clients_and_service()
    except Exception as e:
        print(f"!!! CLIENT INITIALIZATION FAILED: {e}")
        return ("Could not initialize backend services.", 500)

    try:
        request_json = request.get_json(silent=True)
        if not request_json or 'projectId' not in request_json:
            return ("Missing 'projectId' in request body", 400)

        project_id = request_json['projectId']
        print(f"--- Create Google Doc request received for project: {project_id} ---")

        project_ref = db.collection('sow_projects').document(project_id)
        project_data = project_ref.get().to_dict()
        sow_text = project_data.get('generatedSowText', '# Error: SOW Text Not Found')
        sow_title = global_settings.get('sow_title_prefix', 'SOW') + ': ' + project_data.get('projectName', f'Project {project_id}')

        body = {
            'title': sow_title,
            'body': {
                'content': [
                    {
                        'paragraph': {
                            'elements': [{'textRun': {'content': sow_text}}]
                        }
                    }
                ]
            }
        }
        
        doc = service.documents().create(body=body).execute()
        doc_url = f"https://docs.google.com/document/d/{doc['documentId']}/edit"
        
        project_ref.update({'google_doc_url': doc_url})
        print(f"Successfully created Google Doc: {doc_url}")

        return ({'doc_url': doc_url}, 200)

    except Exception as e:
        print(f"!!! CRITICAL ERROR during Google Doc creation: {e}")
        # This line is now guaranteed to be correct.
        return ("An error occurred while creating the Google Doc.", 500)