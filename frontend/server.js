const express = require('express');
const path = require('path');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { GoogleAuth } = require('google-auth-library');

const app = express();
const port = process.env.PORT || 8080;

// --- MODIFIED: Initialize clients without a key file.
// They will use Application Default Credentials when running locally,
// and the attached service account when deployed on Google Cloud.
const firestore = new Firestore();
const storage = new Storage();
const auth = new GoogleAuth();

// --- NEW: Global variable to hold our settings ---
let globalSettings = null;

/**
 * Fetches the settings from Firestore at server startup.
 */
async function loadGlobalSettings() {
  try {
    const docRef = firestore.collection('settings').doc('global_config');
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new Error("CRITICAL: 'global_config' document not found in 'settings' collection.");
    }
    globalSettings = doc.data();
    console.log("✅ Global settings loaded successfully.");
  } catch (error) {
    console.error("❌ FAILED TO LOAD SETTINGS. Server cannot start.", error);
    process.exit(1); // Exit if settings can't be loaded.
  }
}

// --- CORE LOGIC ---

async function startServer() {
  // Load settings before starting the API
  await loadGlobalSettings();

  app.use(cors()); // Consider restricting this in production: app.use(cors({ origin: 'YOUR_FRONTEND_URL' }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.static(path.join(__dirname, 'dist/sow-forge-app/browser')));

  // --- API Endpoints now using globalSettings ---

  // --- SOW PROJECT ENDPOINTS ---

  // Note: The endpoints below are now defined inside startServer()
  // so they have access to the loaded globalSettings.

/**
 * Creates a new SOW Project and all its source document records.
 * Returns the new project ID and a list of signed URLs for the frontend to upload files to.
 */
app.post('/api/projects', async (req, res) => {
  try {
    const { projectName, files } = req.body;
    if (!projectName || !Array.isArray(files) || files.length === 0) {
      return res.status(400).send({ message: 'Project name and a non-empty file list are required.' });
    }

    // 1. Create the main project document
    const projectRef = firestore.collection('sow_projects').doc();
    await projectRef.set({
      projectName: projectName,
      status: 'DRAFTING',
      createdAt: FieldValue.serverTimestamp(),
    });
    const projectId = projectRef.id;
    console.log(`Created new SOW Project with ID: ${projectId}`);

    // 2. Create source document records and generate signed URLs
    const uploadInfo = await Promise.all(files.map(async (file) => {
      const { filename, category, contentType } = file;
      
      // Create a document for this file in the sub-collection
      const docRef = projectRef.collection('source_documents').doc();
      await docRef.set({
        originalFilename: filename,
        category: category,
        status: 'PENDING_UPLOAD',
        createdAt: FieldValue.serverTimestamp(),
      });
      const docId = docRef.id;

      // Generate a signed URL for this specific file
      const gcsFilename = `${projectId}/${docId}/${filename}`; // Use a structured path in GCS
      const options = { version: 'v4', action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType };
      const [url] = await storage.bucket(globalSettings.gcs_uploads_bucket).file(gcsFilename).getSignedUrl(options);
      
      return { docId, signedUrl: url, filename };
    }));

    res.status(201).send({ projectId, uploadInfo });

  } catch (error) {
    console.error('!!! Error creating new SOW project:', error.message);
    res.status(500).send({ message: 'Could not create new SOW project.' });
  }
});

/**
 * Fetches all SOW projects for the dashboard view.
 */
app.get('/api/projects', async (req, res) => {
    try {
        const snapshot = await firestore.collection('sow_projects').orderBy('createdAt', 'desc').get();
        if (snapshot.empty) return res.status(200).send([]);
        
        const projects = snapshot.docs.map(doc => {
            const data = doc.data();
            if (data.createdAt && data.createdAt.toDate) {
                data.createdAt = data.createdAt.toDate().toISOString();
            }
            return { id: doc.id, ...data };
        });
        res.status(200).send(projects);
    } catch (error) {
        console.error('!!! Error fetching SOW projects:', error.message);
        res.status(500).send({ message: 'Could not fetch SOW projects.' });
    }
});

/**
 * Fetches details for a single SOW project, including all its source documents.
 */
app.get('/api/projects/:projectId', async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const projectRef = firestore.collection('sow_projects').doc(projectId);
        
        // Fetch the main project document
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) {
            return res.status(404).send({ message: 'Project not found.' });
        }
        const projectData = projectDoc.data();

        // Fetch all documents from the sub-collection
        const sourceDocsSnapshot = await projectRef.collection('source_documents').orderBy('createdAt').get();
        const sourceDocuments = sourceDocsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Combine and send the response
        res.status(200).send({ ...projectData, id: projectDoc.id, sourceDocuments });

    } catch (error) {
        console.error(`!!! Error fetching project details for ${req.params.projectId}:`, error.message);
        res.status(500).send({ message: 'Could not fetch project details.' });
    }
});

// --- Add these to server.js ---

/**
 * Generic endpoint to update a SOW project document.
 */
app.put('/api/projects/:projectId', async (req, res) => {
    try {
        const docRef = firestore.collection('sow_projects').doc(req.params.projectId);
        // Add a timestamp to every update for tracking
        const updateData = { ...req.body, lastUpdatedAt: FieldValue.serverTimestamp() };
        await docRef.update(updateData);
        res.status(200).send({ message: 'Project updated successfully.' });
    } catch (error) {
        console.error(`!!! Error updating project ${req.params.projectId}:`, error.message);
        res.status(500).send({ message: 'Could not update project.' });
    }
});

/**
 * Deletes a SOW project and all its associated files and sub-collection documents.
 */
app.delete('/api/projects/:projectId', async (req, res) => {
    const projectId = req.params.projectId;
    console.log(`--- DELETE request received for project: ${projectId} ---`);

    try {
        const projectRef = firestore.collection('sow_projects').doc(projectId);

        // 1. Delete all files in the GCS project folders
        const bucket = storage.bucket(globalSettings.gcs_uploads_bucket);
        await bucket.deleteFiles({ prefix: `${projectId}/` });
        console.log(`Deleted all GCS files in folder: ${projectId}/`);

        await storage.bucket(globalSettings.gcs_processed_text_bucket).deleteFiles({ prefix: `${projectId}/` });
        await storage.bucket(globalSettings.gcs_batch_output_bucket).deleteFiles({ prefix: `${projectId}/` });


        // 2. Delete all documents in the sub-collection (requires a recursive helper)
        const subcollectionRef = projectRef.collection('source_documents');
        const subcollectionSnapshot = await subcollectionRef.get();
        const batch = firestore.batch();
        subcollectionSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted all documents in 'source_documents' sub-collection for project ${projectId}.`);
        
        // 3. Finally, delete the main project document
        await projectRef.delete();
        console.log(`Deleted Firestore project document: ${projectId}`);

        res.status(200).send({ message: 'Project and all associated files deleted successfully.' });

    } catch (error) {
        console.error('!!! Error during project deletion:', error.message, error.stack);
        res.status(500).send({ message: 'Could not complete project deletion process.' });
    }
});

// --- UTILITY ENDPOINTS ---

/**
 * Generates a signed URL for direct GCS uploads.
 * Supports uploading to either the main SOW upload bucket or the template samples bucket.
 */
app.post('/api/generate-upload-url', async (req, res) => {
  try {
    const { filename, contentType, targetBucket, projectId, docId } = req.body;
    if (!filename || !contentType || !targetBucket) {
      return res.status(400).send({ message: 'filename, contentType, and targetBucket are required.' });
    }
    
    let gcsPath;
    let bucketName;

    if (targetBucket === 'templates') {
      bucketName = globalSettings.gcs_template_samples_bucket;
      // For templates, the path is just the filename.
      gcsPath = filename;
    } else {
      bucketName = globalSettings.gcs_uploads_bucket;
      // For SOWs, we use the structured path.
      if (!projectId || !docId) {
        return res.status(400).send({ message: 'projectId and docId are required for SOW uploads.' });
      }
      gcsPath = `${projectId}/${docId}/${filename}`;
    }
    
    console.log(`Generating signed URL for path "${gcsPath}" in bucket "${bucketName}"`);

    const options = { version: 'v4', action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType };
    const [url] = await storage.bucket(bucketName).file(gcsPath).getSignedUrl(options);
    
    // Return the GCS path so the frontend knows where the file will be.
    res.status(200).send({ url, gcsPath });

  } catch (error) {
    console.error('!!! Error generating signed URL:', error.message);
    res.status(500).send({ message: 'Could not generate upload URL.' });
  }
});

// NOTE: The rest of the endpoints (/templates, /prompts, /settings, and function proxies)
// can remain largely the same for now. The /api/generate-sow proxy will need to be updated
// in a later phase to pass a projectId instead of a docId.

// --- TEMPLATE MANAGEMENT ENDPOINTS ---
app.get('/api/templates', async (req, res) => {
  try {
    const snapshot = await firestore.collection('templates').orderBy('name').get();
    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).send(templates);
  } catch (error) {
    console.error('!!! Error fetching templates:', error.message);
    res.status(500).send({ message: 'Could not fetch templates.' });
  }
});

app.get('/api/templates/:templateId', async (req, res) => {
  try {
    const docRef = firestore.collection('templates').doc(req.params.templateId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).send({ message: 'Template metadata not found.' });
    const gcsPath = doc.data().gcs_path;
    if (!gcsPath) return res.status(404).send({ message: 'GCS path not found.' });
    const file = storage.bucket(globalSettings.gcs_templates_bucket).file(gcsPath);
    const [markdownContent] = await file.download();
    res.status(200).send({ metadata: { id: doc.id, ...doc.data() }, markdownContent: markdownContent.toString('utf8') });
  } catch (error) {
    console.error('!!! Error fetching template content:', error.message);
    res.status(500).send({ message: 'Could not fetch template content.' });
  }
});

app.put('/api/templates/:templateId', async (req, res) => {
  try {
    const { markdownContent } = req.body;
    if (markdownContent === undefined) return res.status(400).send({ message: 'Missing markdownContent.' });
    const docRef = firestore.collection('templates').doc(req.params.templateId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).send({ message: 'Template metadata not found.' });
    const gcsPath = doc.data().gcs_path;
    const file = storage.bucket(globalSettings.gcs_templates_bucket).file(gcsPath);
    await file.save(markdownContent, { contentType: 'text/markdown' });
    res.status(200).send({ message: 'Template updated successfully.' });
  } catch (error) {
    console.error('!!! Error updating template content:', error.message);
    res.status(500).send({ message: 'Could not update template content.' });
  }
});

app.delete('/api/templates/:templateId', async (req, res) => {
  try {
    const docRef = firestore.collection('templates').doc(req.params.templateId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).send({ message: 'Template not found.' });
    const gcsPath = doc.data().gcs_path;
    if (gcsPath) {
      await storage.bucket(globalSettings.gcs_templates_bucket).file(gcsPath).delete();
    }
    await docRef.delete();
    res.status(200).send({ message: 'Template deleted successfully.' });
  } catch (error) {
    console.error('!!! Error deleting template:', error.message);
    res.status(500).send({ message: 'Could not delete template.' });
  }
});

// --- FUNCTION PROXY ENDPOINTS ---
app.post('/api/generate-sow', async (req, res) => {
  try {
    // --- MODIFIED: Expects projectId ---
    const { projectId, templateId } = req.body;
    const functionUrl = globalSettings.sow_generation_func_url;
    const client = await auth.getIdTokenClient(functionUrl);
    // --- MODIFIED: Sends projectId ---
    const response = await client.request({ url: functionUrl, method: 'POST', data: { projectId, templateId } });
    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('!!! Error proxying to sow-generation-func:', error.response ? error.response.data : error.message);
    res.status(500).send({ message: 'Could not proxy to SOW generation function.' });
  }
});

app.post('/api/generate-template', async (req, res) => {
  try {
    const functionUrl = globalSettings.template_generation_func_url;
    const client = await auth.getIdTokenClient(functionUrl);
    const response = await client.request({ url: functionUrl, method: 'POST', data: req.body });
    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('!!! Error proxying to template-generation-func:', error.response ? error.response.data : error.message);
    res.status(500).send({ message: 'Could not proxy to template generation function.' });
  }
});

// --- Also, update the create-google-doc proxy ---
app.post('/api/create-google-doc', async (req, res) => {
  try {
    const { projectId } = req.body; // Expects projectId now
    const functionUrl = globalSettings.create_google_doc_func_url;
    const client = await auth.getIdTokenClient(functionUrl);
    const response = await client.request({ url: functionUrl, method: 'POST', data: { projectId } }); // Pass projectId
    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('!!! Error proxying to create-google-doc:', error.response ? error.response.data : error.message);
    res.status(500).send({ message: 'Could not proxy to Google Doc creation function.' });
  }
});

// --- SETTINGS AND PROMPTS API ENDPOINTS ---
app.get('/api/settings', async (req, res) => {
  try {
    const docRef = firestore.collection('settings').doc('global_config');
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).send({ message: 'Global config not found.' });
    res.status(200).send(doc.data());
  } catch (error) {
    console.error('!!! Error fetching settings:', error.message);
    res.status(500).send({ message: 'Could not fetch settings.' });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const docRef = firestore.collection('settings').doc('global_config');
    await docRef.set(req.body, { merge: true });
    res.status(200).send({ message: 'Settings updated successfully.' });
  } catch (error) {
    console.error('!!! Error updating settings:', error.message);
    res.status(500).send({ message: 'Could not update settings.' });
  }
});

app.get('/api/prompts', async (req, res) => {
  try {
    const snapshot = await firestore.collection('prompts').get();
    if (snapshot.empty) return res.status(200).send([]);
    const prompts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).send(prompts);
  } catch (error) {
    console.error('!!! Error fetching prompts:', error.message);
    res.status(500).send({ message: 'Could not fetch prompts.' });
  }
});

app.get('/api/prompts/:promptId', async (req, res) => {
  try {
      const docRef = firestore.collection('prompts').doc(req.params.promptId);
      const doc = await docRef.get();
      if (!doc.exists) return res.status(404).send({ message: 'Prompt not found.' });
      res.status(200).send({ id: doc.id, ...doc.data() });
  } catch (error) {
      console.error(`!!! Error fetching prompt ${req.params.promptId}:`, error.message);
      res.status(500).send({ message: 'Could not fetch prompt.' });
  }
});

app.put('/api/prompts/:promptId', async (req, res) => {
  try {
      const { prompt_text } = req.body;
      if (prompt_text === undefined) return res.status(400).send({ message: 'Missing prompt_text.' });
      const docRef = firestore.collection('prompts').doc(req.params.promptId);
      await docRef.update({ prompt_text: prompt_text });
      res.status(200).send({ message: 'Prompt updated successfully.' });
  } catch (error) {
      console.error(`!!! Error updating prompt ${req.params.promptId}:`, error.message);
      res.status(500).send({ message: 'Could not update prompt.' });
  }
});

// --- WILDCARD ROUTE (MUST BE THE VERY LAST ROUTE) ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/sow-forge-app/browser/index.html'));
});
  
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();