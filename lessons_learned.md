
---

## Troubleshooting Session: Backend Deployment Failure (July 18, 2025)

**Goal:** Deploy the backend service to Cloud Run to apply a critical CORS fix. The frontend is deployed and working, but cannot communicate with the backend due to this issue.

**Blocker:** The backend service consistently fails to deploy to Cloud Run with a "container failed to start" error.

### Key Discoveries & Lessons Learned:

*   An early symptom was a `MODULE_NOT_FOUND` error in the build logs, indicating problems with dependency installation or file inclusion in the Docker container.
*   The `backend/Dockerfile` was missing a `COPY . .` command to include all necessary source files (like `server.js`). This was corrected.
*   The `npm install` command was being run in the wrong stage of the Docker build. This was corrected.
*   The deployment script (`deploy.sh`) was not setting the correct Docker build context. It was updated to use the `backend` directory.
*   The backend service requires several environment variables pointing to other Cloud Function URLs. These were missing from the deployment script and subsequently added.
*   Debugging the container's file system was aided by adding `RUN ls -laR` to the `Dockerfile`, which confirmed that the file structure and `node_modules` were correctly placed in the final container image.

### Troubleshooting Steps Taken:

1.  **Initial State:** Frontend deployed to Firebase Hosting. Backend deployment failing.
2.  **CORS Update:** Modified `backend/server.js` to add the frontend's Firebase URL (`https://sow-forge-texas-app.web.app`) to the CORS whitelist.
3.  **Dockerfile Correction (Attempt 1):** Added `COPY . .` and `npm install` to the `backend/Dockerfile` to ensure all files and dependencies were present. Deployment still failed.
4.  **Deployment Script Correction:** Modified `deploy.sh` to correctly set the Docker build context to the `backend` directory. Deployment still failed.
5.  **Environment Variables:** Added the necessary Cloud Function URLs as environment variables to the `gcloud run deploy` command within `deploy.sh`. Deployment still failed.
6.  **Dockerfile Debugging:** Added `RUN ls -laR` to the `Dockerfile` to inspect the container's file system during the build process. The logs from this build confirmed that all files (`server.js`, `package.json`, etc.) and the `node_modules` directory were present in `/usr/src/app` as expected.

**Final Status:** Despite the above fixes, the container continues to fail on startup. The build process now succeeds, and the container image appears to be correctly assembled, but the application itself does not start and listen on the required port. The root cause is still unknown, but is likely an application-level issue within the container rather than a build or file system problem. Accessing the runtime logs for the failed Cloud Run revision is the necessary next step.
