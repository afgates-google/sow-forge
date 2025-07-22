# Lessons Learned

This document summarizes the key lessons learned from the troubleshooting session on July 21, 2025.

## 1. CORS Configuration

*   **Problem:** The initial error was a CORS error, which led to an investigation of the GCS bucket's CORS policy.
*   **Lesson:** The GCS bucket's CORS policy was a red herring. The actual CORS issue was in the backend application, which was not configured to accept requests from the frontend application. This highlights the importance of understanding where CORS is being enforced in your architecture.

## 2. Terraform Deployment

*   **Problem:** The Terraform deployment failed multiple times due to configuration errors.
*   **Lessons:**
    *   The `deployment_suffix` variable is required for Cloud Run deployments to ensure that changes are picked up.
    *   A `google_compute_backend_service` requires a `google_compute_region_network_endpoint_group` to connect to a Cloud Run service.
    *   The `group` attribute of the backend service's backend block must be the `id` of the NEG.
    *   Health checks are not supported for backend services with Serverless NEG backends.

## 3. IAM Permissions

*   **Problem:** The deployment failed multiple times due to missing IAM permissions for the service account.
*   **Lessons:**
    *   The service account used for deployment needs a wide range of permissions.
    *   `gcloud builds submit` requires `Storage Admin` and `Service Usage Consumer` on the Cloud Build bucket.
    *   `docker push` to Artifact Registry requires `Artifact Registry Writer`.
    *   Reading Cloud Run logs requires `Logs Viewer`.

## 4. Application Dependencies

*   **Problem:** The backend application was crashing on startup.
*   **Lesson:** The application was missing the `http-proxy-middleware` npm package. This highlights the importance of ensuring that all dependencies are correctly listed in `package.json`.
