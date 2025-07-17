import sys
import uuid
from google.cloud import firestore

def create_test_project():
    """Creates a new project document in Firestore for testing and prints its ID."""
    try:
        db = firestore.Client()
        project_id = str(uuid.uuid4())
        project_ref = db.collection('sow_projects').document(project_id)
        project_ref.set({
            'projectName': f'Test Project {project_id}',
            'status': 'TEST_SETUP',
            'createdAt': firestore.SERVER_TIMESTAMP
        })
        # Print the ID to stdout so the calling script can capture it
        print(project_id)
    except Exception as e:
        print(f"Error creating test project: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    create_test_project()
