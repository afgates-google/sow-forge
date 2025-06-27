const express = require('express');
const path = require('path');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { GoogleAuth } = require('google-auth-library');

const app = express();
const port = process.env.PORT || 8080;

// --- 1. INITIALIZE GCLOUD CLIENTS ---
console.log("Initializing Google Cloud clients with Application Default Credentials...");
let firestore, storage, auth;
const options = {};
// FOR LOCAL DEVELOPMENT ONLY: Check for a service account key
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.log(`Authenticating with key file: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  options.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
} else {
  console.log("Authenticating with Application Default Credentials (Cloud Run identity).");
}

try {
  firestore = new Firestore();
  storage = new Storage();
  auth = new GoogleAuth();
  console.log("✅ Google Cloud clients initialized successfully.");
} catch (error) {
  console.error('!!! CRITICAL: FAILED TO INITIALIZE GCLOUD CLIENTS !!!', error);
  process.exit(1);
}

// --- 2. GLOBAL SETTINGS LOADER ---
let globalSettings;

async function loadGlobalSettings() {
  try {
    const settingsDoc = await firestore.collection('settings').doc('global_config').get();
    if (!settingsDoc.exists) {
      console.error('!!! CRITICAL: Global config document not found in Firestore! Server shutting down. !!!');
      process.exit(1);
    }
    globalSettings = settingsDoc.data();
    console.log('✅ Global settings loaded successfully.');
    console.log(`   -> Uploads Bucket: ${globalSettings.gcs_uploads_bucket}`);
  } catch (error) {
    console.error('!!! CRITICAL: FAILED TO LOAD GLOBAL SETTINGS !!!', error);
    process.exit(1);
  }
}

// --- 3. MIDDLEWARE ---
const allowedOrigins = [
    'https://4200-w-admin-mc9if4o2.cluster-e3ppspjf3zfnqwaa5t6uqxhwjo.cloudworkstations.dev',
    'http://localhost:4200',
];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// --- 4. ALL API ROUTES ---

// SOW PROJECT ENDPOINTS
app.post('/api/projects', async (req, res) => {
    // ... code from previous version ...
    try {
        const { projectName, files } = req.body;
        if (!projectName || !Array.isArray(files) || files.length === 0) {
          return res.status(400).send({ message: 'Project name and a non-empty file list are required.' });
        }
    
        const projectRef = firestore.collection('sow_projects').doc();
        await projectRef.set({
          projectName: projectName,
          status: 'DRAFTING',
          createdAt: FieldValue.serverTimestamp(),
        });
        const projectId = projectRef.id;
        console.log(`Created new SOW Project with ID: ${projectId}`);
    
        const uploadInfo = await Promise.all(files.map(async (file) => {
          const { filename, category, contentType } = file;
          const docRef = projectRef.collection('source_documents').doc();
          await docRef.set({
            originalFilename: filename,
            displayName: filename,
            category: category,
            status: 'PENDING_UPLOAD',
            createdAt: FieldValue.serverTimestamp(),
          });
          const docId = docRef.id;
    
          const gcsFilename = `${projectId}/${docId}/${filename}`;
          const options = { version: 'v4', action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType };
          const [url] = await storage.bucket(globalSettings.gcs_uploads_bucket).file(gcsFilename).getSignedUrl(options);
          
          return { docId, signedUrl: url, filename };
        }));
    
        res.status(201).send({ projectId, uploadInfo });
    
      } catch (error) {
        console.error('!!! Error creating new SOW project:', error);
        res.status(500).send({ message: 'Could not create new SOW project.' });
      }
});
app.get('/api/projects', async (req, res) => {
    // ... code from previous version ...
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
        console.error('!!! Error fetching SOW projects:', error);
        res.status(500).send({ message: 'Could not fetch SOW projects.' });
      }
});
app.get('/api/projects/:projectId', async (req, res) => {
    // ... code from previous version ...
    try {
        const projectId = req.params.projectId;
        const projectRef = firestore.collection('sow_projects').doc(projectId);
        
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) {
            return res.status(404).send({ message: 'Project not found.' });
        }
        const projectData = projectDoc.data();
    
        const sourceDocsSnapshot = await projectRef.collection('source_documents').orderBy('createdAt').get();
        const sourceDocuments = sourceDocsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
        res.status(200).send({ ...projectData, id: projectDoc.id, sourceDocuments });
    
      } catch (error) {
        console.error(`!!! Error fetching project details for ${req.params.projectId}:`, error);
        res.status(500).send({ message: 'Could not fetch project details.' });
      }
});
app.put('/api/projects/:projectId', async (req, res) => {
    // ... code from previous version ...
    try {
        const docRef = firestore.collection('sow_projects').doc(req.params.projectId);
        const updateData = { ...req.body, lastUpdatedAt: FieldValue.serverTimestamp() };
        await docRef.update(updateData);
        res.status(200).send({ message: 'Project updated successfully.' });
      } catch (error) {
        console.error(`!!! Error updating project ${req.params.projectId}:`, error);
        res.status(500).send({ message: 'Could not update project.' });
      }
});
app.delete('/api/projects/:projectId', async (req, res) => {
    const projectId = req.params.projectId;
    console.log(`--- DELETE request received for project: ${projectId} ---`);
    try {
        const projectRef = firestore.collection('sow_projects').doc(projectId);

        console.log(`Deleting GCS files in bucket ${globalSettings.gcs_uploads_bucket}`);
        await storage.bucket(globalSettings.gcs_uploads_bucket).deleteFiles({ prefix: `${projectId}/` });

        console.log(`Deleting processed text files in bucket ${globalSettings.gcs_processed_text_bucket}`);
        await storage.bucket(globalSettings.gcs_processed_text_bucket).deleteFiles({ prefix: `${projectId}/` });
        
        console.log(`Deleting batch output files in bucket ${globalSettings.gcs_batch_output_bucket}`);
        await storage.bucket(globalSettings.gcs_batch_output_bucket).deleteFiles({ prefix: `${projectId}/` });
        
        console.log(`GCS files for project ${projectId} deleted.`);

        const subcollectionRef = projectRef.collection('source_documents');
        const subcollectionSnapshot = await subcollectionRef.get();
        if (!subcollectionSnapshot.empty) {
            const batch = firestore.batch();
            subcollectionSnapshot.docs.forEach(doc => { batch.delete(doc.ref); });
            await batch.commit();
            console.log(`Deleted 'source_documents' sub-collection.`);
        }

        await projectRef.delete();
        console.log(`Deleted Firestore project document: ${projectId}`);
        res.status(200).send({ message: 'Project and all associated files deleted successfully.' });
    } catch (error) {
        console.error(`!!! Error during project deletion for ${projectId}:`, error);
        res.status(500).send({ message: 'Could not complete project deletion process.' });
    }
});
app.get('/api/projects/:projectId/documents/:docId', async (req, res) => {
    // ... code from previous version ...
    try {
        const { projectId, docId } = req.params;
        const docRef = firestore.collection('sow_projects').doc(projectId).collection('source_documents').doc(docId);
  
        const doc = await docRef.get();
        if (!doc.exists) {
            return res.status(404).json({ message: 'Source document not found.' });
        }
        res.status(200).json({ id: doc.id, ...doc.data() });
    } catch (error) {
        console.error(`!!! Error fetching source document ${req.params.docId}:`, error);
        res.status(500).json({ message: 'Could not fetch source document details.' });
    }
});
app.put('/api/projects/:projectId/source_documents/:docId', async (req, res) => {
    // ... code from previous version ...
    try {
        const { projectId, docId } = req.params;
        const docRef = firestore.collection('sow_projects').doc(projectId).collection('source_documents').doc(docId);
        
        const updateData = { ...req.body, lastUpdatedAt: FieldValue.serverTimestamp() };
        await docRef.update(updateData);
        res.status(200).send({ message: 'Source document updated successfully.' });
      } catch (error) {
        console.error(`!!! Error updating source document ${req.params.docId}:`, error);
        res.status(500).send({ message: 'Could not update source document.' });
      }
});

// TEMPLATE & PROMPT ENDPOINTS
app.get('/api/templates', async (req, res) => {
    try {
        const snapshot = await firestore.collection('templates').orderBy('name').get();
        const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).send(templates);
      } catch (error) {
        console.error('!!! Error fetching templates:', error);
        res.status(500).send({ message: 'Could not fetch templates.' });
      }
});
app.get('/api/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    console.log(`Fetching details for template: ${templateId}`);

    // 1. Get metadata from Firestore
    const docRef = firestore.collection('templates').doc(templateId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'Template metadata not found.' });
    }
    const templateData = doc.data();
    const gcsPath = templateData.gcs_path;

    if (!gcsPath) {
      return res.status(404).json({ message: 'GCS path for template not found in metadata.' });
    }

    // 2. Download the markdown content from GCS
    // Note: This assumes gcs_templates_bucket is defined in your global_config
    const file = storage.bucket(globalSettings.gcs_templates_bucket).file(gcsPath);
    const [markdownContent] = await file.download();

    // 3. Combine and send the response
    res.status(200).json({
      metadata: { id: doc.id, ...templateData },
      markdownContent: markdownContent.toString('utf8')
    });

  } catch (error) {
    console.error(`!!! Error fetching template content for ${req.params.templateId}:`, error);
    res.status(500).json({ message: 'Could not fetch template content.' });
  }
});

// Add this new route to backend/server.js to handle template updates
app.put('/api/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    // The new content will be in the body of the PUT request
    const { markdownContent } = req.body;

    // A safety check to make sure content was actually sent
    if (markdownContent === undefined) {
      return res.status(400).json({ message: 'Missing markdownContent in request body.' });
    }

    console.log(`Updating content for template: ${templateId}`);

    // 1. Get metadata from Firestore to find the file path
    const docRef = firestore.collection('templates').doc(templateId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'Template not found.' });
    }
    const gcsPath = doc.data().gcs_path;

    // 2. Overwrite the file in GCS with the new content
    const file = storage.bucket(globalSettings.gcs_templates_bucket).file(gcsPath);
    await file.save(markdownContent, { contentType: 'text/markdown' });
    
    // 3. Send a success response
    res.status(200).json({ message: 'Template updated successfully.' });

  } catch (error) {
    console.error(`!!! Error updating template ${req.params.templateId}:`, error);
    res.status(500).json({ message: 'Could not update template content.' });
  }
});

// Add this route to backend/server.js to handle template deletion
app.delete('/api/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    console.log(`Deleting template: ${templateId}`);

    // 1. Get metadata from Firestore to find the file path
    const docRef = firestore.collection('templates').doc(templateId);
    const doc = await docRef.get();

    if (doc.exists) {
      const gcsPath = doc.data().gcs_path;

      // 2. If a GCS path exists, delete the file from the bucket
      if (gcsPath) {
        console.log(`Deleting GCS file: ${gcsPath}`);
        await storage.bucket(globalSettings.gcs_templates_bucket).file(gcsPath).delete();
      }

      // 3. Finally, delete the Firestore document
      await docRef.delete();
      console.log(`Deleted Firestore document for template: ${templateId}`);
    }

    // Send a success response even if the doc didn't exist, as the end state is the same.
    res.status(200).json({ message: 'Template deleted successfully.' });

  } catch (error) {
    console.error(`!!! Error deleting template ${req.params.templateId}:`, error);
    res.status(500).json({ message: 'Could not delete template.' });
  }
});
app.get('/api/prompts', async (req, res) => {
    try {
        const snapshot = await firestore.collection('prompts').get();
        if (snapshot.empty) return res.status(200).send([]);
        const prompts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).send(prompts);
      } catch (error) {
        console.error('!!! Error fetching prompts:', error);
        res.status(500).send({ message: 'Could not fetch prompts.' });
      }
});
app.get('/api/prompts/:promptId', async (req, res) => {
  try {
      const docRef = firestore.collection('prompts').doc(req.params.promptId);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).send({ message: 'Prompt not found.' });
      }
      // Use res.json() to ensure correct content-type header for JSON
      res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
      console.error(`!!! Error fetching prompt ${req.params.promptId}:`, error);
      res.status(500).json({ message: 'Could not fetch prompt.' });
  }
});

// (Add other template/prompt routes here if needed)


// FUNCTION PROXY ENDPOINTS
app.post('/api/generate-sow', async (req, res) => {
    try {
        const { projectId, templateId } = req.body;
        const functionUrl = globalSettings.sow_generation_func_url;
        const client = await auth.getIdTokenClient(functionUrl);
        const response = await client.request({ url: functionUrl, method: 'POST', data: { projectId, templateId } });
        res.status(response.status).send(response.data);
    } catch (error) {
        console.error('!!! Error proxying to sow-generation-func:', error.response ? error.response.data : error);
        res.status(500).send({ message: 'Could not proxy to SOW generation function.' });
    }
});
// (Add other proxy routes here if needed)

// --- SETTINGS API ENDPOINTS ---

app.get('/api/settings', async (req, res) => {
  try {
    const docRef = firestore.collection('settings').doc('global_config');
    const doc = await docRef.get();
    if (!doc.exists) {
      // It's better to return a 404 if not found
      return res.status(404).json({ message: 'Global config not found.' });
    }
    // Return the settings as JSON
    res.status(200).json(doc.data());
  } catch (error) {
    console.error('!!! Error fetching settings:', error);
    res.status(500).json({ message: 'Could not fetch settings.' });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const docRef = firestore.collection('settings').doc('global_config');
    // Use set with { merge: true } to non-destructively update the document
    await docRef.set(req.body, { merge: true });
    res.status(200).json({ message: 'Settings updated successfully.' });
  } catch (error) {
    console.error('!!! Error updating settings:', error);
    res.status(500).json({ message: 'Could not update settings.' });
  }
});

// --- 5. WILDCARD ROUTE (MUST BE AFTER ALL API ROUTES) ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});


// --- 6. SERVER STARTUP LOGIC ---
const startServer = async () => {
    console.log('--- Initializing SOW-Forge Server ---');
    await loadGlobalSettings();
    app.listen(port, () => {
      console.log(`🚀 Server listening on port ${port}. SOW-Forge is ready!`);
    });
};
  
startServer();