// The official way to detect if running in a Google Cloud environment
// is to check for the K_SERVICE environment variable, which is always set by Cloud Run.
const IS_PRODUCTION = process.env.K_SERVICE;

// If we are NOT in production (i.e., running locally), then we load the .env file.
if (!IS_PRODUCTION) {
  require('dotenv').config();
}

const express = require('express');
const pino = require('pino');
const pinoHttp = require('pino-http');
const { Storage } = require('@google-cloud/storage');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { PubSub } = require('@google-cloud/pubsub');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { GoogleAuth } = require('google-auth-library');
const { VertexAI } = require('@google-cloud/vertexai');
const { body, validationResult } = require('express-validator');

const app = express();
const port = process.env.PORT || 8080;

// --- 1. LOGGER SETUP ---
const logger = pino({
  level: IS_PRODUCTION ? 'info' : 'debug',
  // In production, Google Cloud Logging will automatically parse JSON logs.
  // For local development, pretty-print the logs for readability.
  transport: IS_PRODUCTION ? undefined : { target: 'pino-pretty' },
});
app.use(pinoHttp({ logger }));


// --- 2. INITIALIZE GCLOUD CLIENTS ---
let firestore, storage, auth, pubsub;

async function initializeGoogleCloudClients() {
    try {
        if (IS_PRODUCTION) {
            // In production, use application default credentials
            firestore = new Firestore();
            storage = new Storage();
            auth = new GoogleAuth();
            pubsub = new PubSub();
        } else {
            // For local development, fetch the key from Secret Manager
            const secretManager = new SecretManagerServiceClient();
            const [version] = await secretManager.accessSecretVersion({
                name: `projects/${process.env.GCLOUD_PROJECT}/secrets/sow-forge-sa-key/versions/latest`,
            });
            const secretPayload = version.payload.data.toString('utf8');
            const credentials = JSON.parse(secretPayload);

            firestore = new Firestore({ credentials });
            storage = new Storage({ credentials });
            auth = new GoogleAuth({ credentials });
            pubsub = new PubSub({ credentials });
        }
        logger.info("✅ Google Cloud clients initialized successfully.");
    } catch (error) {
        logger.fatal('!!! CRITICAL: FAILED TO INITIALIZE GCLOUD CLIENTS !!!', error);
        process.exit(1);
    }
}


// --- 3. MIDDLEWARE & SETTINGS PLACEHOLDER ---
let globalSettings;
app.use(express.json());

// --- CORS Configuration ---
const cors = require('cors');
const corsOptions = {
  origin: function (origin, callback) {
    const { allowedOrigins } = require('./config');
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
};
app.use(cors(corsOptions));


// --- 4. ALL API ROUTES ---

// Helper function to safely convert Firestore timestamps
const convertTimestamps = (data) => {
  for (const key in data) {
    if (data[key] && typeof data[key].toDate === 'function') {
      data[key] = data[key].toDate().toISOString();
    }
  }
  return data;
};

app.post('/api/projects',
  body('projectName').isString().trim().escape(),
  body('files').isArray(),
  body('files.*.filename').isString().trim().escape(),
  body('files.*.category').isString().trim().escape(),
  body('files.*.contentType').isString().trim().escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { projectName, files } = req.body;
      const projectRef = firestore.collection('sow_projects').doc();
      await projectRef.set({ projectName, status: 'DRAFTING', createdAt: FieldValue.serverTimestamp() });
      const uploadInfo = await Promise.all(files.map(async (file) => {
        const { filename, category, contentType } = file;
        const docRef = projectRef.collection('source_documents').doc();
        await docRef.set({ originalFilename: filename, displayName: filename, category, status: 'PENDING_UPLOAD', createdAt: FieldValue.serverTimestamp() });
        const gcsFilename = `${projectRef.id}/${docRef.id}/${filename}`;
        const options = { version: 'v4', action: 'write', expires: Date.now() + globalSettings.gcs_signed_url_expiration_minutes * 60 * 1000, contentType };
        const [url] = await storage.bucket(globalSettings.gcs_uploads_bucket).file(gcsFilename).getSignedUrl(options);
        return { docId: docRef.id, signedUrl: url, filename };
      }));
      res.status(201).send({ projectId: projectRef.id, uploadInfo });
    } catch (error) {
      req.log.error({ err: error, message: 'Error creating new SOW project' });
      res.status(500).send({ message: 'Could not create SOW project.' });
    }
  });

app.get('/api/projects', async (req, res) => {
  try {
    const snapshot = await firestore.collection('sow_projects').orderBy('createdAt', 'desc').get();
    const projects = snapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }));
    res.status(200).send(projects);
  } catch (error) {
    req.log.error({ err: error, message: 'Error fetching SOW projects' });
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
    req.log.error({ err: error, projectId: req.params.projectId, message: 'Error fetching project details' });
    res.status(500).send({ message: 'Could not fetch project details.' });
  }
});

app.put('/api/projects/:projectId',
  body().custom(value => {
    // Ensure no unexpected fields are present
    const allowedFields = ['projectName', 'status'];
    for (const key in value) {
      if (!allowedFields.includes(key)) {
        throw new Error(`Unexpected field: ${key}`);
      }
    }
    return true;
  }),
  body('projectName').optional().isString().trim().escape(),
  body('status').optional().isString().trim().escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const docRef = firestore.collection('sow_projects').doc(req.params.projectId);
      await docRef.update({ ...req.body, lastUpdatedAt: FieldValue.serverTimestamp() });
      res.status(200).send({ message: 'Project updated successfully.' });
    } catch (error) {
      req.log.error({ err: error, projectId: req.params.projectId, message: 'Error updating project' });
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
    req.log.error({ err: error, docId: req.params.docId, message: 'Error fetching source document' });
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
    req.log.error({ err: error, message: 'Error triggering re-analysis' });
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
    req.log.error({ err: error, sowId: req.params.sowId, message: 'Error fetching SOW' });
    res.status(500).json({ message: 'Could not fetch SOW details.' });
  }
});

app.put('/api/projects/:projectId/sows/:sowId',
  body().custom(value => {
    const allowedFields = ['generatedSowText'];
    for (const key in value) {
      if (!allowedFields.includes(key)) {
        throw new Error(`Unexpected field: ${key}`);
      }
    }
    return true;
  }),
  body('generatedSowText').optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { projectId, sowId } = req.params;
      const sowRef = firestore.collection('sow_projects').doc(projectId).collection('generated_sow').doc(sowId);
      await sowRef.update(req.body);
      res.status(200).json({ message: 'SOW updated successfully.' });
    } catch (error) {
      req.log.error({ err: error, sowId: req.params.sowId, message: 'Error updating SOW' });
      res.status(500).json({ message: 'Could not update SOW.' });
    }
  });

app.delete('/api/projects/:projectId', async (req, res) => {
  const { projectId } = req.params;
  try {
      req.log.info(`--- DELETE request for project: ${projectId} ---`);

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
      req.log.info(`Successfully deleted project document ${projectId}`);
      res.status(200).send({ message: 'Project deleted successfully.' });

  } catch (error) {
      req.log.error({ err: error, projectId, message: 'Error deleting project' });
      res.status(500).send({ message: 'Could not delete project.' });
  }
});

// TEMPLATES
app.get('/api/templates', async (req, res) => {
  try {
    const snapshot = await firestore.collection('templates').orderBy('name').get();
    res.status(200).send(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    req.log.error({ err: error, message: 'Error fetching templates' });
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
    req.log.error({ err: error, templateId: req.params.templateId, message: 'Error fetching template content' });
    res.status(500).json({ message: 'Could not fetch template content.' });
  }
});

app.put('/api/templates/:templateId',
  body().custom(value => {
    const allowedFields = ['markdownContent', 'name', 'description'];
    for (const key in value) {
      if (!allowedFields.includes(key)) {
        throw new Error(`Unexpected field: ${key}`);
      }
    }
    return true;
  }),
  body('markdownContent').optional().isString(),
  body('name').optional().isString().trim().escape(),
  body('description').optional().isString().trim().escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
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
        req.log.error({ err: error, templateId: req.params.templateId, message: 'Error updating template' });
        res.status(500).json({ message: 'Could not update template.' });
    }
  });

// PROMPTS (These were missing)
app.get('/api/prompts', async (req, res) => {
  try {
    const snapshot = await firestore.collection('prompts').get();
    res.status(200).send(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    req.log.error({ err: error, message: 'Error fetching prompts' });
    res.status(500).send({ message: 'Could not fetch prompts.' });
  }
});

app.get('/api/prompts/:promptId', async (req, res) => {
  try {
    const doc = await firestore.collection('prompts').doc(req.params.promptId).get();
    if (!doc.exists) return res.status(404).send({ message: 'Prompt not found.' });
    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    req.log.error({ err: error, promptId: req.params.promptId, message: 'Error fetching prompt' });
    res.status(500).json({ message: 'Could not fetch prompt.' });
  }
});

app.put('/api/prompts/:promptId',
  body().custom(value => {
    const allowedFields = ['prompt_text', 'name'];
    for (const key in value) {
      if (!allowedFields.includes(key)) {
        throw new Error(`Unexpected field: ${key}`);
      }
    }
    return true;
  }),
  body('prompt_text').optional().isString(),
  body('name').optional().isString().trim().escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      await firestore.collection('prompts').doc(req.params.promptId).update(req.body);
      res.status(200).send({ message: 'Prompt updated successfully.' });
    } catch (error) {
      req.log.error({ err: error, promptId: req.params.promptId, message: 'Error updating prompt' });
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
    req.log.error({ err: error, message: 'Error fetching settings' });
    res.status(500).json({ message: 'Could not fetch settings.' });
  }
});

app.put('/api/settings',
  body().custom(value => {
    // This is a simplified example. A real implementation should have a more robust
    // way of validating the settings object.
    for (const key in value) {
      if (typeof value[key] !== 'string' && typeof value[key] !== 'number' && typeof value[key] !== 'boolean') {
        throw new Error(`Invalid value for setting: ${key}`);
      }
    }
    return true;
  }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      await firestore.collection('settings').doc('global_config').set(req.body, { merge: true });
      res.status(200).json({ message: 'Settings updated successfully.' });
    } catch (error) {
      req.log.error({ err: error, message: 'Error updating settings' });
      res.status(500).json({ message: 'Could not update settings.' });
    }
  });

// FUNCTION PROXIES
app.post('/api/generate-sow',
  body('projectId').isString().trim().escape(),
  body('templateId').isString().trim().escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const functionUrl = globalSettings.sow_generation_func_url;
      const client = await auth.getIdTokenClient(functionUrl);
      const response = await client.request({ url: functionUrl, method: 'POST', data: req.body });
      res.status(response.status).send(response.data);
    } catch (error) {
      req.log.error({ err: error.response ? error.response.data : error, message: 'Error proxying to sow-generation-func' });
      res.status(500).send({ message: 'Could not proxy to SOW generation function.' });
    }
  });

app.post('/api/create-google-doc',
  body('docId').isString().trim().escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const functionUrl = globalSettings.create_google_doc_func_url;
      const client = await auth.getIdTokenClient(functionUrl);
      const response = await client.request({ url: functionUrl, method: 'POST', data: req.body });
      res.status(response.status).send(response.data);
    } catch (error) {
      req.log.error({ err: error.response ? error.response.data : error, message: 'Error proxying to create-google-doc-func' });
      res.status(500).send({ message: 'Could not proxy to Google Doc creation function.' });
    }
  });

// ... other proxy routes like generate-template would go here ...

// --- 5. SERVER STARTUP LOGIC ---
async function startServer() {
  logger.info('--- Initializing SOW-Forge Server ---');
  try {
    // 0. Initialize Google Cloud Clients
    await initializeGoogleCloudClients();

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
      'gcp_project_id',
      'vertex_ai_location',
      'sow_generation_model',
      'sow_generation_prompt_id'
    ];

    const missingSettings = requiredSettings.filter(key => !globalSettings[key]);

    if (missingSettings.length > 0) {
      throw new Error(`CRITICAL: The following required settings are missing from 'settings/global_config': ${missingSettings.join(', ')}`);
    }
    
    logger.info('✅ Global settings loaded and validated successfully.');

    // 3. Start the server
    app.listen(port, () => {
      logger.info(`🚀 Server listening on port ${port}. SOW-Forge is ready!`);
    });

  } catch (error) {
    logger.fatal({ err: error }, '!!!    SERVER FAILED TO STARTUP         !!!');
    process.exit(1);
  }
}

// Start the server.
startServer();
