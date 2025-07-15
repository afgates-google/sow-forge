
import google.auth
from google.cloud import firestore

def update_gcs_bucket_setting():
    """
    Connects to Firestore and updates the 'gcs_uploads_bucket' setting.
    """
    try:
        # Attempt to get default credentials and project ID
        credentials, project_id = google.auth.default()
        print(f"Successfully authenticated. Project ID: {project_id}")

        # Initialize Firestore client
        db = firestore.Client(project=project_id, credentials=credentials)
        print("Firestore client initialized.")

        # Get the document reference
        doc_ref = db.collection('settings').document('global_config')

        # Get the current settings
        doc = doc_ref.get()
        if not doc.exists:
            print("Error: 'settings/global_config' document not found.")
            return

        current_settings = doc.to_dict()
        current_bucket = current_settings.get('gcs_uploads_bucket')
        print(f"Current 'gcs_uploads_bucket' value: {current_bucket}")

        # The correct bucket name
        correct_bucket = "sow-forge-texas-dmv-uploads"

        if current_bucket == correct_bucket:
            print("Bucket name is already correct. No update needed.")
            return

        # Update the setting
        print(f"Updating 'gcs_uploads_bucket' to '{correct_bucket}'...")
        doc_ref.update({'gcs_uploads_bucket': correct_bucket})
        print("✅ Successfully updated the GCS bucket name in Firestore.")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    update_gcs_bucket_setting()
