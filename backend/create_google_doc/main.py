import functions_framework
from google.cloud import firestore
from googleapiclient.discovery import build
from google.oauth2 import service_account

@functions_framework.http
def create_doc(request):
    """
    An HTTP-triggered function that creates a new Google Doc from SOW text.
    """
    # We need the service account key to create an authenticated Docs client
    # In a real app, you'd use a more secure way to get these credentials.
    # For this demo, we assume the function's own SA has access.
    # It needs "Google Docs API" enabled and potentially domain-wide delegation.
    
    # NOTE: This part is complex and often requires special auth setup.
    # This code provides the basic structure.
    
    request_json = request.get_json(silent=True)
    doc_id = request_json.get('docId')

    if not doc_id:
        return ("Missing 'docId' in request body.", 400)

    try:
        db = firestore.Client()
        doc_ref = db.collection('sows').document(doc_id)
        doc_data = doc_ref.get().to_dict()
        sow_text = doc_data.get('generated_sow', '# Error: SOW Text Not Found')
        
        # This uses the function's default service account credentials
        creds = service_account.Credentials.from_service_account_file(
            'PATH_TO_YOUR_SA_KEY.json',  # This needs to be handled securely
            scopes=['https://www.googleapis.com/auth/documents']
        )

        service = build('docs', 'v1', credentials=creds)

        title = f"SOW Draft: {doc_data.get('original_filename', doc_id)}"
        body = {
            'title': title,
            'body': {
                'content': [
                    {
                        'paragraph': {
                            'elements': [
                                {'textRun': {'content': sow_text}}
                            ]
                        }
                    }
                ]
            }
        }
        
        document = service.documents().create(body=body).execute()
        doc_url = f"https://docs.google.com/document/d/{document.get('documentId')}/edit"
        
        print(f"Created document with ID: {document.get('documentId')}")
        
        # Save the URL back to Firestore
        doc_ref.update({'google_doc_url': doc_url})
        
        return ({'doc_url': doc_url}, 200)

    except Exception as e:
        print(f"!!! CRITICAL ERROR creating Google Doc: {e}")
        return (f"An error occurred: {e}", 500)