import sys
from google.cloud import firestore

def delete_test_project(project_id):
    """Deletes the specified project document from Firestore."""
    try:
        db = firestore.Client()
        project_ref = db.collection('sow_projects').document(project_id)
        project_ref.delete()
        print(f"Successfully deleted test project: {project_id}")
    except Exception as e:
        print(f"Error deleting test project {project_id}: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 delete_test_project.py <project_id>", file=sys.stderr)
        sys.exit(1)
    delete_test_project(sys.argv[1])
