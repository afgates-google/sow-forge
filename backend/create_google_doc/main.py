import functions_framework
from google.cloud import firestore
from googleapiclient.discovery import build

# --- Initialize clients in global scope ---
db = firestore.Client()

@functions_framework.http
def create_doc(request):
    """
    Creates a Google Doc, now configured from Firestore settings.
    """
    print("Create Google Doc function triggered for a project.")
    
    try:
        # --- NEW: Load all configuration from Firestore ---
        settings_ref = db.collection('settings').document('global_config')
        settings = settings_ref.get().to_dict()
        
        SCOPES = settings.get('google_docs_api_scopes', 'https://www.googleapis.com/auth/documents').split(',')
        DELEGATED_ADMIN_EMAIL = settings.get('gsuite_delegated_admin_email')

        # This assumes the function's own service account has been granted Domain-Wide Delegation
        # permissions in the Google Workspace Admin console.
        # This is the secure way to do this without a key file.
        from google.auth import default
        creds, _ = default(scopes=SCOPES)
        
        # If a delegated admin is specified, create new credentials to impersonate that user
        if DELEGATED_ADMIN_EMAIL:
            creds = creds.with_subject(DELEGATED_ADMIN_EMAIL)
            print(f"Impersonating G-Suite user: {DELEGATED_ADMIN_EMAIL}")

        service = build('docs', 'v1', credentials=creds)
        
        request_json = request.get_json(silent=True)
        if not request_json or 'projectId' not in request_json:
            return ("Missing 'projectId' in request body", 400)

        project_id = request_json['projectId']
        project_ref = db.collection('sow_projects').document(project_id)
        project_data = project_ref.get().to_dict()
        sow_text = project_data.get('generatedSowText', '# Error: SOW Text Not Found')
        sow_title = project_data.get('projectName', f'SOW for Project {project_id}')

        body = { 'title': sow_title, 'body': { 'content': [{'paragraph': {'elements': [{'textRun': {'content': sow_text}}]}}]}}
        
        doc = service.documents().create(body=body).execute()
        doc_url = f"https://docs.google.com/document/d/{doc['documentId']}/edit"
        
        project_ref.update({'google_doc_url': doc_url})

        return ({'doc_url': doc_url}, 200)

    except Exception as e:
        print(f"!!! CRITICAL ERROR during Google Doc creation: {e}")
        return ("An error occurred while creating the Google Doc.", 500)./de    