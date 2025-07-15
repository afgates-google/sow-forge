import google.auth
from google.cloud import firestore
import logging
import sys

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def update_gcs_bucket_setting():
    """
    Connects to Firestore and updates the 'gcs_uploads_bucket' setting.
    """
    try:
        # Attempt to get default credentials and project ID
        credentials, project_id = google.auth.default()
        logger.info(f"Successfully authenticated. Project ID: {project_id}")

        # Initialize Firestore client
        db = firestore.Client(project=project_id, credentials=credentials)
        logger.info("Firestore client initialized.")

        # Get the document reference
        doc_ref = db.collection('settings').document('global_config')

        # Get the current settings
        doc = doc_ref.get()
        if not doc.exists:
            logger.error("Error: 'settings/global_config' document not found.")
            return

        current_settings = doc.to_dict()
        current_bucket = current_settings.get('gcs_uploads_bucket')
        logger.info(f"Current 'gcs_uploads_bucket' value: {current_bucket}")

        # The correct bucket name
        correct_bucket = "sow-forge-texas-dmv-uploads"

        if current_bucket == correct_bucket:
            logger.info("Bucket name is already correct. No update needed.")
            return

        # Update the setting
        logger.info(f"Updating 'gcs_uploads_bucket' to '{correct_bucket}'...")
        doc_ref.update({'gcs_uploads_bucket': correct_bucket})
        logger.info("✅ Successfully updated the GCS bucket name in Firestore.")

    except Exception as e:
        logger.critical(f"An error occurred: {e}", exc_info=True)

if __name__ == '__main__':
    update_gcs_bucket_setting()