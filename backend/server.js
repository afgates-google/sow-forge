// The official way to detect if running in a Google Cloud environment
// is to check for the K_SERVICE environment variable, which is always set by Cloud Run.
const IS_PRODUCTION = process.env.K_SERVICE;

// If we are NOT in production (i.e., running locally), then we load the .env file.
if (!IS_PRODUCTION) {
  require('dotenv').config();
}

const express = require('express');
const { Storage } = require('@google-cloud/storage');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { PubSub } = require('@google-cloud/pubsub');
const { GoogleAuth } = require('google-auth-library');

const app = express();
const port = process.env.PORT || 8080;

// --- 1. INITIALIZE GCLOUD CLIENTS ---
console.log("Initializing Google Cloud clients...");
let firestore, storage, auth, pubsub;
try {
  firestore = new Firestore();
  storage = new Storage();
  auth = new GoogleAuth();
  pubsub = new PubSub();
  console.log("✅ Google Cloud clients initialized successfully.");
} catch (error) {
  console.error('!!! CRITICAL: FAILED TO INITIALIZE GCLOUD CLIENTS !!!', error);
  process.exit(1);
}

// --- 2. MIDDLEWARE & SETTINGS PLACEHOLDER ---
let globalSettings;
app.use(express.json());


// --- 3. ALL API ROUTES ---

// Helper function to safely convert Firestore timestamps
const convertTimestamps = (data) => {
  for (const key in data) {
    if (data[key] && typeof data[key].toDate === 'function') {
      data[key] = data[key].toDate().toISOString();
    }
  }
  return data;
};

app.post('/api/projects', async (req, res) => {
  try {
    const { projectName, files } = req.body;
    if (!projectName || !Array.isArray(files) || files.length === 0) {
      return res.status(400).send({ message: 'Project name and files are required.' });
    }
    const projectRef = firestore.collection('sow_projects').doc();
    await projectRef.set({ projectName, status: 'DRAFTING', createdAt: FieldValue.serverTimestamp() });
    const uploadInfo = await Promise.all(files.map(async (file) => {
      const { filename, category, contentType } = file;
      const docRef = projectRef.collection('source_documents').doc();
      await docRef.set({ originalFilename: filename, displayName: filename, category, status: 'PENDING_UPLOAD', createdAt: FieldValue.serverTimestamp() });
      const gcsFilename = `${projectRef.id}/${docRef.id}/${filename}`;
      const options = { version: 'v4', action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType };
      const [url] = await storage.bucket(globalSettings.gcs_uploads_bucket).file(gcsFilename).getSignedUrl(options);
      return { docId: docRef.id, signedUrl: url, filename };
    }));
    res.status(201).send({ projectId: projectRef.id, uploadInfo });
  } catch (error) {
    console.error('Error creating new SOW project:', error);
    res.status(500).send({ message: 'Could not create SOW project.' });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    const snapshot = await firestore.collection('sow_projects').orderBy('createdAt', 'desc').get();
    const projects = snapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));
    res.status(200).send(projects);
  } catch (error) {
    console.error('Error fetching SOW projects:', error);
    res.status(500).send({ message: 'Could not fetch SOW projects.' });
  }
});

app.get('/api/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const projectRef = firestore.collection('sow_projects').doc(projectId);
    const [projectDoc, sourceDocsSnapshot, generatedSowsSnapshot] = await Promise.all([
      projectRef.get(),
      projectRef.collection('source_documents').orderBy('createdAt').get(),
      projectRef.collection('generated_sow').orderBy('createdAt', 'desc').get()
    ]);
    if (!projectDoc.exists) return res.status(404).send({ message: 'Project not found.' });

    // Apply timestamp conversion to all fetched documents
    const projectData = convertTimestamps(projectDoc.data());
    const sourceDocuments = sourceDocsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const generatedSows = generatedSowsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).send({ ...projectDoc.data(), id: projectDoc.id, sourceDocuments, generatedSows });
  } catch (error) {
    console.error(`Error fetching project details for ${req.params.projectId}:`, error);
    res.status(500).send({ message: 'Could not fetch project details.' });
  }
});

app.put('/api/projects/:projectId', async (req, res) => {
  try {
    const docRef = firestore.collection('sow_projects').doc(req.params.projectId);
    await docRef.update({ ...req.body, lastUpdatedAt: FieldValue.serverTimestamp() });
    res.status(200).send({ message: 'Project updated successfully.' });
  } catch (error) {
    console.error(`Error updating project ${req.params.projectId}:`, error);
    res.status(500).send({ message: 'Could not update project.' });
  }
});

app.get('/api/projects/:projectId/documents/:docId', async (req, res) => {
  try {
    const { projectId, docId } = req.params;
    const doc = await firestore.collection('sow_projects').doc(projectId).collection('source_documents').doc(docId).get();
    if (!doc.exists) return res.status(404).json({ message: 'Source document not found.' });
    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error(`Error fetching source document ${req.params.docId}:`, error);
    res.status(500).json({ message: 'Could not fetch source document.' });
  }
});

app.post('/api/projects/:projectId/source_documents/:docId/regenerate', async (req, res) => {
  try {
    const { projectId, docId } = req.params;
    const topicName = globalSettings.eventarc_gcs_uploads_topic;
    const bucketName = globalSettings.gcs_uploads_bucket;
    if (!topicName || !bucketName) throw new Error("Eventarc or GCS config missing from global settings.");
    const docRef = firestore.collection('sow_projects').doc(projectId).collection('source_documents').doc(docId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ message: 'Document not found.' });
    await docRef.update({ status: 'RE_ANALYZING' });
    const gcsFilename = `${projectId}/${docId}/${doc.data().originalFilename}`;
    const dataBuffer = Buffer.from(JSON.stringify({ bucket: bucketName, name: gcsFilename }));
    await pubsub.topic(topicName).publishMessage({ data: dataBuffer });
    res.status(200).send({ message: 'Re-analysis triggered successfully.' });
  } catch (error) {
    console.error('Error triggering re-analysis:', error);
    res.status(500).send({ message: 'Could not trigger re-analysis.' });
  }
});

app.get('/api/projects/:projectId/sows/:sowId', async (req, res) => {
  try {
    const { projectId, sowId } = req.params;
    const projectDoc = await firestore.collection('sow_projects').doc(projectId).get();
    const sowDoc = await firestore.collection('sow_projects').doc(projectId).collection('generated_sow').doc(sowId).get();
    if (!projectDoc.exists || !sowDoc.exists) return res.status(404).json({ message: 'Project or SOW not found.' });
    res.status(200).json({ project: { id: projectDoc.id, name: projectDoc.data().projectName }, sow: { id: sowDoc.id, ...sowDoc.data() } });
  } catch (error) {
    console.error(`Error fetching SOW ${req.params.sowId}:`, error);
    res.status(500).json({ message: 'Could not fetch SOW details.' });
  }
});

app.put('/api/projects/:projectId/sows/:sowId', async (req, res) => {
  try {
    const { projectId, sowId } = req.params;
    const sowRef = firestore.collection('sow_projects').doc(projectId).collection('generated_sow').doc(sowId);
    await sowRef.update(req.body);
    res.status(200).json({ message: 'SOW updated successfully.' });
  } catch (error) {
    console.error(`Error updating SOW ${req.params.sowId}:`, error);
    res.status(500).json({ message: 'Could not update SOW.' });
  }
});

app.delete('/api/projects/:projectId', async (req, res) => {
  const { projectId } = req.params;
  try {
      console.log(`--- DELETE request for project: ${projectId} ---`);

      // A full implementation should also delete all sub-collections and GCS files.
      // For now, we'll just delete the project document itself.
      const projectRef = firestore.collection('sow_projects').doc(projectId);
      
      // Example of deleting a sub-collection (uncomment if needed)
      /*
      const documents = await projectRef.collection('source_documents').get();
      const batch = firestore.batch();
      documents.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      */

      await projectRef.delete();
      console.log(`Successfully deleted project document ${projectId}`);
      res.status(200).send({ message: 'Project deleted successfully.' });

  } catch (error) {
      console.error(`!!! Error deleting project ${projectId}:`, error);
      res.status(500).send({ message: 'Could not delete project.' });
  }
});

// TEMPLATES
app.get('/api/templates', async (req, res) => {
  try {
    const snapshot = await firestore.collection('templates').orderBy('name').get();
    res.status(200).send(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).send({ message: 'Could not fetch templates.' });
  }
});

app.get('/api/templates/:templateId', async (req, res) => {
  try {
    const doc = await firestore.collection('templates').doc(req.params.templateId).get();
    if (!doc.exists) return res.status(404).json({ message: 'Template metadata not found.' });
    const [markdownContent] = await storage.bucket(globalSettings.gcs_templates_bucket).file(doc.data().gcs_path).download();
    res.status(200).json({ metadata: { id: doc.id, ...doc.data() }, markdownContent: markdownContent.toString('utf8') });
  } catch (error) {
    console.error(`Error fetching template content for ${req.params.templateId}:`, error);
    res.status(500).json({ message: 'Could not fetch template content.' });
  }
});

app.put('/api/templates/:templateId', async (req, res) => {
    try {
        const { templateId } = req.params;
        const { markdownContent, ...metadataToUpdate } = req.body;
        const docRef = firestore.collection('templates').doc(templateId);
        if (markdownContent !== undefined) {
            const doc = await docRef.get();
            if (!doc.exists) return res.status(404).json({ message: 'Template not found.' });
            const file = storage.bucket(globalSettings.gcs_templates_bucket).file(doc.data().gcs_path);
            await file.save(markdownContent, { contentType: 'text/markdown' });
        }
        if (Object.keys(metadataToUpdate).length > 0) {
            await docRef.update(metadataToUpdate);
        }
        res.status(200).json({ message: 'Template updated successfully.' });
    } catch (error) {
        console.error(`Error updating template ${req.params.templateId}:`, error);
        res.status(500).json({ message: 'Could not update template.' });
    }
});

// PROMPTS (These were missing)
app.get('/api/prompts', async (req, res) => {
  try {
    const snapshot = await firestore.collection('prompts').get();
    res.status(200).send(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).send({ message: 'Could not fetch prompts.' });
  }
});

app.get('/api/prompts/:promptId', async (req, res) => {
  try {
    const doc = await firestore.collection('prompts').doc(req.params.promptId).get();
    if (!doc.exists) return res.status(404).send({ message: 'Prompt not found.' });
    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error(`Error fetching prompt ${req.params.promptId}:`, error);
    res.status(500).json({ message: 'Could not fetch prompt.' });
  }
});

app.put('/api/prompts/:promptId', async (req, res) => {
  try {
    await firestore.collection('prompts').doc(req.params.promptId).update(req.body);
    res.status(200).send({ message: 'Prompt updated successfully.' });
  } catch (error) {
    console.error(`Error updating prompt ${req.params.promptId}:`, error);
    res.status(500).send({ message: 'Could not update prompt.' });
  }
});

// SETTINGS (These were missing)
app.get('/api/settings', async (req, res) => {
  try {
    const doc = await firestore.collection('settings').doc('global_config').get();
    if (!doc.exists) return res.status(404).json({ message: 'Global config not found.' });
    res.status(200).json(doc.data());
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Could not fetch settings.' });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    await firestore.collection('settings').doc('global_config').set(req.body, { merge: true });
    res.status(200).json({ message: 'Settings updated successfully.' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Could not update settings.' });
  }
});

// FUNCTION PROXIES
app.post('/api/generate-sow', async (req, res) => {
  try {
    const functionUrl = globalSettings.sow_generation_func_url;
    const client = await auth.getIdTokenClient(functionUrl);
    const response = await client.request({ url: functionUrl, method: 'POST', data: req.body });
    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('Error proxying to sow-generation-func:', error.response ? error.response.data : error);
    res.status(500).send({ message: 'Could not proxy to SOW generation function.' });
  }
});

app.post('/api/create-google-doc', async (req, res) => {
  try {
    const functionUrl = globalSettings.create_google_doc_func_url;
    const client = await auth.getIdTokenClient(functionUrl);
    const response = await client.request({ url: functionUrl, method: 'POST', data: req.body });
    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('Error proxying to create-google-doc-func:', error.response ? error.response.data : error);
    res.status(500).send({ message: 'Could not proxy to Google Doc creation function.' });
  }
});

// ... other proxy routes like generate-template would go here ...

// --- 4. SERVER STARTUP LOGIC ---
async function startServer() {
  console.log('--- Initializing SOW-Forge Server ---');
  try {
    // 1. Fetch settings from Firestore
    const settingsDoc = await firestore.collection('settings').doc('global_config').get();
    if (!settingsDoc.exists) {
      throw new Error("CRITICAL: Global config document 'settings/global_config' not found in Firestore!");
    }
    globalSettings = settingsDoc.data();

    // 2. Validate that all required settings are present
    const requiredSettings = [
      'gcs_uploads_bucket',
      'gcs_templates_bucket',
      'eventarc_gcs_uploads_topic',
      'sow_generation_func_url',
      'create_google_doc_func_url'
    ];

    const missingSettings = requiredSettings.filter(key => !globalSettings[key]);

    if (missingSettings.length > 0) {
      throw new Error(`CRITICAL: The following required settings are missing from 'settings/global_config': ${missingSettings.join(', ')}`);
    }
    
    console.log('✅ Global settings loaded and validated successfully.');

    // 3. Start the server
    app.listen(port, () => {
      console.log(`🚀 Server listening on port ${port}. SOW-Forge is ready!`);
    });

  } catch (error) {
    console.error('!!!    SERVER FAILED TO STARTUP         !!!', error);
    process.exit(1);
  }
}

// Start the server.
startServer();