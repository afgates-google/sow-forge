import os
from google.cloud import firestore

def get_ids_from_firestore():
    """Fetches the first project ID and template ID from Firestore."""
    try:
        project = os.environ.get('GCLOUD_PROJECT')
        db = firestore.Client(project=project)

        print("--- Fetching Project IDs from 'sow_projects' ---")
        projects = list(db.collection('sow_projects').limit(1).stream())
        if not projects:
            print("No projects found in 'sow_projects' collection.")
            return None, None
        project_id = projects[0].id
        print(f"Found Project ID: {project_id}")

        print("\n--- Fetching Template IDs from 'templates' ---")
        templates = list(db.collection('templates').limit(1).stream())
        if not templates:
            print("No templates found in 'templates' collection.")
            return None, None
        template_id = templates[0].id
        print(f"Found Template ID: {template_id}")

        return project_id, template_id

    except Exception as e:
        print(f"An error occurred: {e}")
        return None, None

if __name__ == "__main__":
    get_ids_from_firestore()
