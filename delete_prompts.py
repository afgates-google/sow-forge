import os
from google.cloud import firestore

# --- Configuration ---
PROJECT_ID = os.getenv("GCLOUD_PROJECT")
PROMPTS_COLLECTION = "prompts"

REDUNDANT_PROMPTS = [
    "legislative_analysis_default",
    "legislative_analysis_prompt",
    "project_plan_analysis_prompt",
    "security_analysis_prompt",
    "sow_generation_prompt",
    "technical_analysis_prompt",
    "template_generation_default",
]

def delete_redundant_prompts():
    """Deletes redundant prompts from the prompts collection."""
    db = firestore.Client(project=PROJECT_ID)
    for prompt_id in REDUNDANT_PROMPTS:
        prompt_ref = db.collection(PROMPTS_COLLECTION).document(prompt_id)
        if prompt_ref.get().exists:
            print(f"Deleting prompt: {prompt_id}")
            prompt_ref.delete()
        else:
            print(f"Prompt not found, skipping: {prompt_id}")

if __name__ == "__main__":
    delete_redundant_prompts()