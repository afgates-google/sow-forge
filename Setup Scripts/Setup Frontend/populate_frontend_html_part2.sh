#!/bin/bash

# SOW-Forge Frontend HTML Population Script (Part 2 - Final)
#
# This script populates the remaining HTML template files for the management pages.
# It assumes the file and directory skeleton has already been created.
#
# USAGE: Run this script from the root of the 'sow-forge' project.
# > chmod +x populate_frontend_html_part2.sh
# > ./populate_frontend_html_part2.sh

set -e

echo " SOW-FORGE HTML POPULATION (PART 2) "
echo "====================================="
echo

# Navigate to the frontend directory
if [ ! -d "frontend" ]; then
    echo "ERROR: 'frontend' directory not found. Please run this script from the 'sow-forge' root."
    exit 1
fi
cd frontend

# --- 1. Populate Results Page HTML ---
echo "-> Populating results.component.html..."

tee src/app/pages/results/results.component.html > /dev/null <<'EOF'
<div class="results-container">
  <div *ngIf="isLoading" class="loading-state"><p>Loading analysis results...</p></div>
  <div *ngIf="errorMessage" class="error-message"><p>{{ errorMessage }}</p></div>

  <div *ngIf="results">
    <div class="results-header">
      <h2>Analysis for: {{ results.display_name || results.original_filename }}</h2>
      <button (click)="regenerateAnalysis()" [disabled]="isGeneratingSow" class="btn-secondary">
        <span>{{ isGeneratingSow ? 'Regenerating...' : 'Regenerate Analysis' }}</span>
      </button>
    </div>
    <p *ngIf="statusMessage" class="status-message">{{ statusMessage }}</p>

    <div *ngIf="results.analysis" class="analysis-content">
      <div class="summary-section card">
        <h3>AI Summary</h3>
        <p>{{ results.analysis.summary }}</p>
      </div>

      <div class="requirements-section">
        <h3>Extracted Requirements</h3>
        <table *ngIf="results.analysis.requirements?.length > 0; else noRequirements">
          <thead>
            <tr>
              <th>ID</th>
              <th>Description</th>
              <th>Type</th>
              <th>Deadline</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let req of results.analysis.requirements">
              <td>{{ req.id }}</td>
              <td>{{ req.description }}</td>
              <td>{{ req.type }}</td>
              <td>{{ req.deadline }}</td>
            </tr>
          </tbody>
        </table>
        <ng-template #noRequirements><p>No specific requirements were extracted by the AI.</p></ng-template>
      </div>
    </div>

    <div *ngIf="templates.length > 0" class="template-selection">
      <hr>
      <h3>Select a Template to Generate SOW</h3>
      <ul>
        <li *ngFor="let template of templates">
          <span><strong>{{ template.name }}</strong>: {{ template.description }}</span>
          <button (click)="generateSow(template.id)" [disabled]="isGeneratingSow" class="btn-primary">
            <span>{{ isGeneratingSow ? 'Generating...' : 'Generate SOW' }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</div>
EOF

# --- 2. Populate Settings Page HTML ---
echo "-> Populating settings.component.html..."

tee src/app/pages/settings/settings.html > /dev/null <<'EOF'
<div class="settings-container">
  <h2>Application Settings</h2>
  <p>Control the AI models, prompts, and other parameters used by the system.</p>
  
  <div *ngIf="isLoading"><p>Loading settings...</p></div>

  <div *ngIf="!isLoading" class="settings-form card">
    <div class="setting-group">
      <h4>Legislative Analysis Configuration</h4>
      <div class="form-field">
        <label for="leg-model">AI Model</label>
        <select id="leg-model" [(ngModel)]="settings.legislative_analysis_model">
          <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
          <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
          <option value="text-bison@002">Text Bison (Legacy)</option>
        </select>
      </div>
      <div class="form-field">
        <label for="leg-prompt">Analysis Prompt</label>
        <select id="leg-prompt" [(ngModel)]="settings.legislative_analysis_prompt_id">
          <option *ngFor="let p of prompts" [value]="p.id">{{ p.name }}</option>
        </select>
      </div>
    </div>
    <div class="setting-group">
      <h4>SOW Generation Configuration</h4>
      <div class="form-field">
        <label for="sow-model">AI Model</label>
        <select id="sow-model" [(ngModel)]="settings.sow_generation_model">
          <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
          <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
          <option value="text-bison@002">Text Bison (Legacy)</option>
        </select>
      </div>
      <div class="form-field">
        <label for="sow-prompt">Generation Prompt</label>
        <select id="sow-prompt" [(ngModel)]="settings.sow_generation_prompt_id">
          <option *ngFor="let p of prompts" [value]="p.id">{{ p.name }}</option>
        </select>
      </div>
    </div>
    <div class="setting-group">
      <h4>AI Behavior & Tuning</h4>
      <div class="form-field">
        <label for="analysis-temp">Analysis Temperature (0.0 - 1.0)</label>
        <input id="analysis-temp" type="number" step="0.1" min="0" max="1" [(ngModel)]="settings.analysis_model_temperature">
      </div>
      <div class="form-field">
        <label for="sow-gen-temp">SOW Generation Temperature (0.0 - 1.0)</label>
        <input id="sow-gen-temp" type="number" step="0.1" min="0" max="1" [(ngModel)]="settings.sow_generation_model_temperature">
      </div>
      <div class="form-field">
        <label for="max-tokens">Max Output Tokens (SOW Generation)</label>
        <input id="max-tokens" type="number" step="256" min="256" [(ngModel)]="settings.sow_generation_max_tokens">
      </div>
    </div>
    <div class="setting-group">
      <h4>Operational Settings</h4>
      <div class="form-field">
        <label for="page-limit">Synchronous Page Limit</label>
        <input id="page-limit" type="number" [(ngModel)]="settings.sync_page_limit">
      </div>
      <div class="form-field">
        <label for="docai-id">Document AI Processor ID</label>
        <input id="docai-id" type="text" [(ngModel)]="settings.docai_processor_id">
      </div>
    </div>
    <div class="actions">
      <button (click)="saveSettings()" [disabled]="isSaving">{{ isSaving ? 'Saving...' : 'Save All Settings' }}</button>
      <span class="status-message">{{ statusMessage }}</span>
    </div>
  </div>
</div>
EOF

# --- 3. Populate Prompt Manager HTML ---
echo "-> Populating prompt-manager.component.html..."

tee src/app/pages/prompt-manager/prompt-manager.component.html > /dev/null <<'EOF'
<div class="prompt-manager-container">
  <h2>AI Prompt Management</h2>
  <p>Edit the prompts used by the AI to generate analysis and content. Changes take effect immediately.</p>
  <div class="card">
    <div class="form-field">
      <label for="prompt-select">Select a Prompt to Edit</label>
      <div *ngIf="isLoadingList">Loading prompts...</div>
      <select *ngIf="!isLoadingList" id="prompt-select" [(ngModel)]="selectedPromptId" (change)="onPromptSelected()">
        <option value="">-- Choose a prompt --</option>
        <option *ngFor="let p of prompts" [value]="p.id">{{ p.name }} ({{p.id}})</option>
      </select>
    </div>
    <div *ngIf="selectedPromptId" class="form-field">
      <label for="prompt-text">Prompt Text</label>
      <div *ngIf="isLoadingPrompt" class="loading-prompt">Loading...</div>
      <textarea *ngIf="!isLoadingPrompt" id="prompt-text" class="prompt-editor" [(ngModel)]="editablePromptText"></textarea>
    </div>
    <div *ngIf="selectedPromptId" class="actions">
      <button (click)="savePrompt()" [disabled]="isPristine() || isSaving">{{ isSaving ? 'Saving...' : 'Save Prompt' }}</button>
      <span class="status-message">{{ statusMessage }}</span>
    </div>
  </div>
</div>
EOF

# --- 4. Populate Template Manager HTML ---
echo "-> Populating template-manager.component.html..."

tee src/app/pages/template-manager/template-manager.component.html > /dev/null <<'EOF'
<div class="manager-container">
  <h2>SOW Template Management</h2>
  <div class="card create-template-card">
    <h3>Create New Template from Samples</h3>
    <p>Upload one or more sample SOWs (PDF, TXT, or MD). The AI will analyze them to create a reusable template.</p>
    <div class="form-group">
      <label for="templateName">New Template Name</label>
      <input id="templateName" type="text" [(ngModel)]="newTemplateName" placeholder="e.g., Standard IT Services Template">
    </div>
    <div class="form-group">
      <label for="templateDesc">Description</label>
      <textarea id="templateDesc" [(ngModel)]="newTemplateDescription" rows="3" placeholder="A brief description..."></textarea>
    </div>
    <div class="form-group">
      <label>Sample SOW Files</label>
      <input #fileInput type="file" (change)="onFilesSelected($event)" accept=".pdf,.txt,.md" multiple hidden>
      <button (click)="fileInput.click()" class="browse-button">Browse for Files</button>
    </div>
    <div *ngIf="selectedFiles.length > 0" class="file-list">
      <strong>Selected Samples:</strong>
      <ul><li *ngFor="let file of selectedFiles">{{ file.name }}</li></ul>
    </div>
    <button class="action-btn" (click)="generateTemplate()" [disabled]="!newTemplateName || selectedFiles.length === 0 || isGenerating">
      {{ isGenerating ? 'Generating...' : 'Generate AI Template' }}
    </button>
    <div *ngIf="statusMessage" class="status-message">{{ statusMessage }}</div>
  </div>
  <div class="card existing-templates-card">
    <h3>Existing Templates</h3>
    <div *ngIf="isLoadingTemplates">Loading templates...</div>
    <ul *ngIf="!isLoadingTemplates && existingTemplates.length > 0">
      <li *ngFor="let template of existingTemplates">
        <span class="template-info">
          <strong>{{ template.name }}</strong>
          <span>{{ template.description }}</span>
        </span>
        <span class="template-actions">
          <a [routerLink]="['/templates', template.id, 'edit']" class="edit-btn">Edit</a>
          <button (click)="deleteTemplate(template.id, template.name)" class="delete-btn">Delete</button>
        </span>
      </li>
    </ul>
    <p *ngIf="!isLoadingTemplates && existingTemplates.length === 0">No templates found.</p>
  </div>
</div>
EOF

# --- 5. Populate Template Editor HTML ---
echo "-> Populating template-editor.component.html..."

tee src/app/pages/template-editor/template-editor.component.html > /dev/null <<'EOF'
<div class="editor-container">
  <div class="editor-header">
    <a routerLink="/templates" class="back-button">← Back to Template Management</a>
    <h2 *ngIf="templateDoc">Editing Template: {{ templateDoc.name }}</h2>
    <div class="actions">
      <button (click)="saveTemplate()" [disabled]="isSaving" class="save-button">{{ isSaving ? 'Saving...' : 'Save Template' }}</button>
      <span class="save-status">{{ statusMessage }}</span>
    </div>
  </div>
  <div *ngIf="templateDoc" class="editor-body">
    <div class="tab-nav">
      <button (click)="activeTab = 'editor'" [class.active]="activeTab === 'editor'">Editor</button>
      <button (click)="activeTab = 'preview'" [class.active]="activeTab === 'preview'">Preview</button>
    </div>
    <div class="tab-content">
      <div *ngIf="activeTab === 'editor'" class="editor-pane">
        <textarea class="sow-editor" [(ngModel)]="editableTemplateText"></textarea>
      </div>
      <div *ngIf="activeTab === 'preview'" class="preview-pane">
        <markdown class="sow-preview" [data]="editableTemplateText"></markdown>
      </div>
    </div>
  </div>
  <div *ngIf="isLoading"><p>Loading template...</p></div>
  <div *ngIf="errorMessage"><p class="error">{{ errorMessage }}</p></div>
</div>
EOF

echo
echo "--------------------------------------------------------"
echo " SUCCESS: All remaining HTML files populated."
echo "--------------------------------------------------------"
echo "-> Your frontend source code is now complete."
echo