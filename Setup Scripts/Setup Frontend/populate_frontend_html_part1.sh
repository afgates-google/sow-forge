#!/bin/bash

# SOW-Forge Frontend HTML Population Script (Part 1)
#
# This script populates the most critical HTML template files.
# It assumes the file and directory skeleton has already been created.
#
# USAGE: Run this script from the root of the 'sow-forge' project.
# > chmod +x populate_frontend_html_part1.sh
# > ./populate_frontend_html_part1.sh

set -e

echo " SOW-FORGE HTML POPULATION (PART 1) "
echo "====================================="
echo

# Navigate to the frontend directory
if [ ! -d "frontend" ]; then
    echo "ERROR: 'frontend' directory not found. Please run this script from the 'sow-forge' root."
    exit 1
fi
cd frontend

# --- 1. Populate Core App HTML ---
echo "-> Populating app.component.html..."

tee src/app/app.component.html > /dev/null <<'EOF'
<div class="app-container">
  <header class="app-header">
    <h1>SOW-Forge</h1>
    <p>AI-Powered Statement of Work Generation</p>
  </header>
  <nav class="app-tabs">
    <a routerLink="/" routerLinkActive="active-tab" [routerLinkActiveOptions]="{exact: true}">Create New SOW</a>
    <a routerLink="/history" routerLinkActive="active-tab">Document Dashboard</a>
    <a routerLink="/templates" routerLinkActive="active-tab">Template Management</a>
    <a routerLink="/prompts" routerLinkActive="active-tab">Prompt Management</a>
    <a routerLink="/settings" routerLinkActive="active-tab">Settings</a>
  </nav>
  <main class="app-content">
    <router-outlet></router-outlet>
  </main>
</div>
EOF

# --- 2. Populate Upload Component HTML ---
echo "-> Populating upload.component.html..."

tee src/app/components/upload/upload.component.html > /dev/null <<'EOF'
<div class="creator-card">
  <div class="card-header">
    <h2>Create a New SOW from a Legislative Bill</h2>
    <p>Start by uploading a PDF document. The system will do the rest.</p>
  </div>

  <div *ngIf="!selectedFile"
       class="drop-zone"
       (click)="fileInput.click()"
       (dragover)="onDragOver($event)"
       (dragleave)="onDragLeave($event)"
       (drop)="onDrop($event)">
    <input #fileInput type="file" (change)="onFileSelected($event)" accept=".pdf" hidden>
    
    <div class="drop-zone-prompt">
      <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h5l5 5v7a4 4 0 01-4 4H7z" />
      </svg>
      <p><strong>Drag & Drop your PDF here</strong></p>
      <p class="browse-text">or click to browse</p>
    </div>
  </div>

  <div *ngIf="selectedFile" class="file-info-container">
    <div class="file-details">
      <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span>{{ selectedFile.name }}</span>
      <button (click)="removeFile()" class="remove-file-btn" title="Remove file">×</button>
    </div>

    <button class="action-btn" (click)="uploadFile()" [disabled]="isUploading || isPolling">
      <span *ngIf="!isUploading && !isPolling">Analyze & Generate SOW</span>
      <span *ngIf="isUploading">Uploading...</span>
      <span *ngIf="isPolling">Analysis in Progress...</span>
    </button>

    <div *ngIf="uploadProgress > 0 || isPolling" class="progress-container">
      <div class="progress-bar"><div class="progress" [style.width.%]="uploadProgress"></div></div>
      <p class="status-message">{{ statusMessage }}</p>
    </div>
  </div>
</div>
EOF

# --- 3. Populate Dashboard HTML ---
echo "-> Populating dashboard.component.html..."

tee src/app/pages/dashboard/dashboard.component.html > /dev/null <<'EOF'
<div class="dashboard-container">
  <h2>Document Dashboard</h2>
  <p *ngIf="statusMessage" class="status-message">{{ statusMessage }}</p>

  <div *ngIf="isLoading" class="loading-state">Loading documents...</div>

  <table *ngIf="!isLoading && sows.length > 0" class="dashboard-table">
    <thead>
      <tr>
        <th>Document Name</th>
        <th>Status</th>
        <th>Last Updated</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let sow of sows" [class.processing]="sow.status.includes('PROCESSING')">
        <td>
          <div *ngIf="editingDocId === sow.id" class="edit-name-form">
            <input [(ngModel)]="editingDocName" (keyup.enter)="saveName(sow.id)" (keyup.escape)="cancelEditing()" cdkFocusInitial>
            <button (click)="saveName(sow.id)" class="save-name-btn">Save</button>
            <button (click)="cancelEditing()" class="cancel-name-btn">Cancel</button>
          </div>
          <div *ngIf="editingDocId !== sow.id" class="display-name-form">
            <span>{{ sow.display_name || sow.original_filename }}</span>
            <button (click)="startEditingName(sow)" class="edit-icon-btn" title="Edit name">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
            </button>
          </div>
        </td>
        <td><span class="status-badge" [ngClass]="sow.status | lowercase">{{ sow.status }}</span></td>
        <td>{{ (sow.last_updated_at || sow.created_at) | date:'short' }}</td>
        <td class="actions-cell">
          <a *ngIf="sow.analysis" [routerLink]="['/results', sow.id]" class="action-link view-btn">View Analysis</a>
          <a *ngIf="sow.generated_sow" [routerLink]="['/editor', sow.id]" class="action-link edit-sow">Edit SOW</a>
        </td>
      </tr>
    </tbody>
  </table>
  <div *ngIf="!isLoading && sows.length === 0" class="no-docs">
    <p>No documents found. Go to "Create New SOW" to start.</p>
  </div>
</div>
EOF

# --- 4. Populate SOW Editor HTML ---
echo "-> Populating editor.component.html..."

tee src/app/pages/editor/editor.component.html > /dev/null <<'EOF'
<div class="editor-container">
  <div class="editor-header">
    <a routerLink="/history" class="back-button">← Back to Dashboard</a>
    <h2 *ngIf="sowDocument">Editing SOW for: {{ sowDocument.original_filename }}</h2>
    <div class="actions">
      <button (click)="saveSow()" [disabled]="isSaving" class="save-button">
        {{ isSaving ? 'Saving...' : 'Save SOW' }}
      </button>
      <button (click)="openInGoogleDocs()" [disabled]="isCreatingDoc" class="gdocs-button">
        {{ (sowDocument && sowDocument.google_doc_url) ? 'Open in Google Docs' : 'Create Google Doc' }}
      </button>
      <span class="save-status">{{ saveStatusMessage }}</span>
    </div>
  </div>
  <div *ngIf="sowDocument" class="editor-body">
    <div class="tab-nav">
      <button (click)="activeTab = 'editor'" [class.active]="activeTab === 'editor'">Editor</button>
      <button (click)="activeTab = 'preview'" [class.active]="activeTab === 'preview'">Preview</button>
    </div>
    <div class="tab-content">
      <div *ngIf="activeTab === 'editor'" class="editor-pane">
        <textarea class="sow-editor" [(ngModel)]="editableSowText"></textarea>
      </div>
      <div *ngIf="activeTab === 'preview'" class="preview-pane">
        <markdown class="sow-preview" [data]="editableSowText"></markdown>
      </div>
    </div>
  </div>
  <div *ngIf="isLoading"><p>Loading SOW document...</p></div>
  <div *ngIf="errorMessage"><p class="error">{{ errorMessage }}</p></div>
</div>
EOF

echo
echo "--------------------------------------------------------"
echo " SUCCESS: Part 1 of HTML files populated."
echo "--------------------------------------------------------"
echo "-> Next, run 'populate_frontend_html_part2.sh' to finish."
echo