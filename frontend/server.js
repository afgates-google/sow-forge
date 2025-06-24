const express = require('express');
const path = require('path');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { GoogleAuth } = require('google-auth-library');

const app = express();
const port = process.env.PORT || 8080;

// Define the absolute path to your key file for reliable authentication
const KEY_FILE_PATH = path.join(__dirname, 'sa-key.json');

// Initialize Google Cloud clients ONCE at the top.
const firestore = new Firestore({ keyFilename: KEY_FILE_PATH });
const storage = new Storage({ keyFilename: KEY_FILE_PATH });
const auth = new GoogleAuth({ keyFilename: KEY_FILE_PATH });

app.use(cors());
app.use(express.json());

// Serve the static Angular app from the 'dist' folder
// The folder name is based on the "name" in your package.json
app.use(express.static(path.join(__dirname, 'dist/sow-forge-app/browser')));

// --- CORE API ROUTES ---

app.post('/api/generate-upload-url', async (req, res) => {
  try {
    const { filename, contentType, targetBucket } = req.body;
    if (!filename || !contentType) {
      return res.status(400).send({ message: 'Filename and contentType are required.' });
    }
    const bucketName = targetBucket === 'templates' 
      ? 'sow-forge-texas-dmv-template-samples' 
      : 'sow-forge-texas-dmv-uploads';
    
    const options = { version: 'v4', action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType };
    const [url] = await storage.bucket(bucketName).file(filename).getSignedUrl(options);
    res.status(200).send({ url });
  } catch (error) {
    console.error('!!! Error generating signed URL:', error.message);
    res.status(500).send({ message: 'Could not generate upload URL.' });
  }
});

// Endpoint for the Document Dashboard
app.get('/api/sows', async (req, res) => {
  try {
    const snapshot = await firestore.collection('sows').orderBy('created_at', 'desc').get();
    if (snapshot.empty) return res.status(200).send([]);
    
    const allSows = snapshot.docs.map(doc => {
        const data = doc.data();
        if (data.created_at && data.created_at.toDate) data.created_at = data.created_at.toDate().toISOString();
        if (data.last_updated_at && data.last_updated_at.toDate) data.last_updated_at = data.last_updated_at.toDate().toISOString();
        return { id: doc.id, ...data };
    });

    const filteredSows = allSows.filter(sow => sow.is_template_sample !== true);
    res.status(200).send(filteredSows);
  } catch (error) {
    console.error('!!! Error fetching SOW documents:', error.message);
    res.status(500).send({ message: 'Could not fetch SOW documents.' });
  }
});

// Endpoint for a single SOW's results/details
app.get('/api/results/:docId', async (req, res) => {
  try {
    const docRef = firestore.collection('sows').doc(req.params.docId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).send({ message: 'Document not found' });
    res.status(200).send(doc.data());
  } catch (error) {
    console.error('!!! Error fetching Firestore document:', error.message);
    res.status(500).send({ message: 'Could not fetch document.' });
  }
});

// Generic endpoint to update a SOW document
app.put('/api/sows/:docId', async (req, res) => {
    try {
        const docRef = firestore.collection('sows').doc(req.params.docId);
        const updateData = { ...req.body, last_updated_at: FieldValue.serverTimestamp() };
        await docRef.update(updateData);
        res.status(200).send({ message: 'Document updated successfully.' });
    } catch (error) {
        console.error(`!!! Error updating document ${req.params.docId}:`, error.message);
        res.status(500).send({ message: 'Could not update document.' });
    }
});

// Endpoint to re-trigger the full analysis pipeline
app.post('/api/regenerate/:docId', async (req, res) => {
  try {
    const docRef = firestore.collection('sows').doc(req.params.docId);
    const doc = await docRef.get();
    if (!doc.exists || !doc.data().original_filename) {
      return res.status(404).send({ message: 'Original filename not found.' });
    }
    const file = storage.bucket('sow-forge-texas-dmv-uploads').file(doc.data().original_filename);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).send({ message: `Original PDF file not found.` });
    
    await file.setMetadata({ metadata: { regenerated_at: new Date().toISOString() }});
    await docRef.update({ status: 'REANALYSIS_IN_PROGRESS', last_updated_at: FieldValue.serverTimestamp() });
    res.status(200).send({ message: 'Pipeline re-triggered successfully.' });
  } catch (error) {
    console.error('!!! Error re-triggering pipeline:', error.message);
    res.status(500).send({ message: 'Could not re-trigger pipeline.' });
  }
});

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
    const file = storage.bucket('sow-forge-texas-dmv-templates').file(gcsPath);
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
    const file = storage.bucket('sow-forge-texas-dmv-templates').file(gcsPath);
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
      await storage.bucket('sow-forge-texas-dmv-templates').file(gcsPath).delete();
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
    const { docId, templateId } = req.body;
    const functionUrl = 'https://sow-generation-func-zaolvsfwta-uc.a.run.app';
    const client = await auth.getIdTokenClient(functionUrl);
    const response = await client.request({ url: functionUrl, method: 'POST', data: { docId, templateId } });
    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('!!! Error proxying to sow-generation-func:', error.response ? error.response.data : error.message);
    res.status(500).send({ message: 'Could not proxy to SOW generation function.' });
  }
});

app.post('/api/generate-template', async (req, res) => {
  try {
    const functionUrl = 'https://template-generation-func-zaolvsfwta-uc.a.run.app';
    const client = await auth.getIdTokenClient(functionUrl);
    const response = await client.request({ url: functionUrl, method: 'POST', data: req.body });
    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('!!! Error proxying to template-generation-func:', error.response ? error.response.data : error.message);
    res.status(500).send({ message: 'Could not proxy to template generation function.' });
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
app.delete('/api/sows/:docId', async (req, res) => {
  const docId = req.params.docId;
  console.log(`--- DELETE request received for document: ${docId} ---`);

  try {
    const docRef = firestore.collection('sows').doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).send({ message: 'Document not found, cannot delete.' });
    }
    const sowData = doc.data();

    // 1. Delete the original PDF from the uploads bucket
    if (sowData.original_filename) {
      try {
        await storage.bucket('sow-forge-texas-dmv-uploads').file(sowData.original_filename).delete();
        console.log(`Deleted GCS object: sow-forge-texas-dmv-uploads/${sowData.original_filename}`);
      } catch (gcsError) {
        console.warn(`Could not delete original PDF (it may have been deleted already): ${gcsError.message}`);
      }
    }

    // 2. Delete the processed text file
    const txtFilename = `${docId}.txt`;
    try {
      await storage.bucket('sow-forge-texas-dmv-processed-text').file(txtFilename).delete();
      console.log(`Deleted GCS object: sow-forge-texas-dmv-processed-text/${txtFilename}`);
    } catch (gcsError) {
      console.warn(`Could not delete processed text file: ${gcsError.message}`);
    }
    
    // 3. Delete the batch output folder (if it exists)
    if (sowData.processing_method === 'batch') {
      try {
        const [files] = await storage.bucket('sow-forge-texas-dmv-batch-output').getFiles({ prefix: `${docId}/` });
        await Promise.all(files.map(file => file.delete()));
        console.log(`Deleted batch output folder and contents for: ${docId}`);
      } catch (gcsError) {
        console.warn(`Could not delete batch output folder: ${gcsError.message}`);
      }
    }

    // 4. Finally, delete the Firestore document
    await docRef.delete();
    console.log(`Deleted Firestore document: ${docId}`);

    res.status(200).send({ message: 'Document and all associated files deleted successfully.' });

  } catch (error) {
    console.error('!!! Error during SOW deletion:', error.message);
    res.status(500).send({ message: 'Could not complete deletion process.' });
  }
});

// --- WILDCARD ROUTE (MUST BE THE VERY LAST ROUTE) ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/sow-forge-app/browser/index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});