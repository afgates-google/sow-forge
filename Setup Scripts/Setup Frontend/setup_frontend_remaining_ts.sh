#!/bin/bash

# SOW-Forge Remaining TypeScript Population Script
#
# This script populates the remaining 6 page component .ts files with
# their final, correct logic. It assumes the file and directory
# skeleton has already been created.
#
# USAGE: Run this script from the root of the 'sow-forge' project.
# > chmod +x populate_remaining_ts.sh
# > ./populate_remaining_ts.sh

set -e

echo " SOW-FORGE REMAINING TYPESCRIPT POPULATION "
echo "=========================================="
echo

# Navigate to the frontend directory
if [ ! -d "frontend" ]; then
    echo "ERROR: 'frontend' directory not found. Please run this script from the 'sow-forge' root."
    exit 1
fi
cd frontend

# --- Populate Remaining Page .ts Files ---
echo "-> Populating page component TypeScript files..."

# Results Page
tee src/app/pages/results/results.component.ts > /dev/null <<'EOF'
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.css']
})
export class ResultsComponent implements OnInit {
  docId: string | null = null;
  results: any = null;
  isLoading = true;
  errorMessage = '';
  templates: any[] = [];
  isGeneratingSow = false;
  statusMessage = '';

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.docId = this.route.snapshot.paramMap.get('id');
    if (this.docId) {
      this.apiService.getAnalysisResults(this.docId).subscribe({
        next: (data) => { this.results = data; this.isLoading = false; },
        error: (err) => { this.errorMessage = `Error: ${err.error?.message || err.message}`; this.isLoading = false; }
      });
      this.apiService.getTemplates().subscribe({
        next: (data) => { this.templates = data; },
        error: (err) => { console.error('Could not load templates:', err); }
      });
    } else {
      this.errorMessage = 'No document ID provided in URL.';
      this.isLoading = false;
    }
  }

  generateSow(templateId: string): void {
    if (!this.docId) return;
    this.isGeneratingSow = true;
    this.statusMessage = 'Generating SOW... This may take a minute.';
    this.apiService.generateSow(this.docId, templateId).subscribe({
      next: () => {
        this.isGeneratingSow = false;
        this.router.navigate(['/editor', this.docId]);
      },
      error: (err) => {
        this.isGeneratingSow = false;
        this.errorMessage = `Failed to generate SOW: ${err.error?.message || err.message}`;
      }
    });
  }

  regenerateAnalysis(): void {
    if (!this.docId) return;
    this.isGeneratingSow = true; // Reuse the flag for UI feedback
    this.statusMessage = 'Re-triggering analysis pipeline...';
    this.apiService.regenerateAnalysis(this.docId).subscribe({
        next: () => {
            this.statusMessage = 'Re-analysis triggered successfully! Refresh the dashboard in a few minutes to see updates.';
            this.isGeneratingSow = false;
            setTimeout(() => this.statusMessage = '', 5000);
        },
        error: (err) => {
            this.statusMessage = `Error regenerating analysis: ${err.error?.message || err.message}`;
            this.isGeneratingSow = false;
        }
    });
  }
}
EOF

# Editor Page
tee src/app/pages/editor/editor.component.ts > /dev/null <<'EOF'
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { ApiService } from '../../services/api.service';
@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MarkdownModule],
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css']
})
export class EditorComponent implements OnInit {
  sowDocument: any = null;
  docId: string | null = null;
  editableSowText = '';
  isLoading = true;
  isSaving = false;
  isCreatingDoc = false;
  errorMessage = '';
  saveStatusMessage = '';
  activeTab: 'editor' | 'preview' = 'editor';
  constructor(private route: ActivatedRoute, private apiService: ApiService) {}
  ngOnInit(): void {
    this.docId = this.route.snapshot.paramMap.get('id');
    if (this.docId) {
      this.apiService.getAnalysisResults(this.docId).subscribe({
        next: (data) => {
          this.sowDocument = data;
          this.editableSowText = data.generated_sow || 'SOW has not been generated for this document yet.';
          this.isLoading = false;
        },
        error: (err) => { this.errorMessage = `Error fetching document: ${err.message}`; this.isLoading = false; }
      });
    } else {
      this.errorMessage = 'No document ID provided in the URL.';
      this.isLoading = false;
    }
  }
  saveSow(): void {
    if (!this.docId || !this.editableSowText) return;
    this.isSaving = true;
    this.saveStatusMessage = 'Saving...';
    this.apiService.updateDocument(this.docId, { generated_sow: this.editableSowText }).subscribe({
      next: () => { this.isSaving = false; this.saveStatusMessage = 'SOW saved successfully!'; setTimeout(() => this.saveStatusMessage = '', 3000); },
      error: (err: any) => { this.isSaving = false; this.saveStatusMessage = `Error saving SOW: ${err.message}`; }
    });
  }
  openInGoogleDocs(): void {
    if (!this.docId) return;
    if (this.sowDocument && this.sowDocument.google_doc_url) { window.open(this.sowDocument.google_doc_url, '_blank'); return; }
    this.isCreatingDoc = true;
    this.saveStatusMessage = 'Creating Google Doc...';
    this.apiService.createGoogleDoc(this.docId).subscribe({
      next: (response: any) => {
        this.isCreatingDoc = false;
        this.saveStatusMessage = 'Document created successfully!';
        this.sowDocument.google_doc_url = response.doc_url; 
        window.open(response.doc_url, '_blank');
        setTimeout(() => this.saveStatusMessage = '', 3000);
      },
      error: (err: any) => { this.isCreatingDoc = false; this.saveStatusMessage = `Error creating document: ${err.message}`; }
    });
  }
}
EOF

# Template Manager Page
tee src/app/pages/template-manager/template-manager.component.ts > /dev/null <<'EOF'
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap, map, filter } from 'rxjs/operators';
import { HttpEventType } from '@angular/common/http';
@Component({
  selector: 'app-template-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './template-manager.html',
  styleUrls: ['./template-manager.css']
})
export class TemplateManagerComponent implements OnInit {
  newTemplateName = '';
  newTemplateDescription = '';
  selectedFiles: File[] = [];
  isGenerating = false;
  statusMessage = '';
  existingTemplates: any[] = [];
  isLoadingTemplates = true;
  constructor(private apiService: ApiService) {}
  ngOnInit(): void { this.loadTemplates(); }
  loadTemplates(): void { this.isLoadingTemplates = true; this.apiService.getTemplates().subscribe({ next: (data) => { this.existingTemplates = data; this.isLoadingTemplates = false; }, error: (err) => { console.error('Failed to load templates', err); this.isLoadingTemplates = false; } }); }
  onFilesSelected(event: any): void { if (event.target.files) { this.selectedFiles = Array.from(event.target.files); } }
  deleteTemplate(templateId: string, templateName: string): void { if (confirm(`Are you sure you want to delete "${templateName}"?`)) { this.apiService.deleteTemplate(templateId).subscribe({ next: () => { this.statusMessage = `Template deleted.`; this.loadTemplates(); }, error: (err: any) => { this.statusMessage = `Error: ${err.message}`; } }); } }
  generateTemplate(): void { if (!this.newTemplateName || this.selectedFiles.length === 0) return; this.isGenerating = true; this.statusMessage = `Uploading ${this.selectedFiles.length} sample(s)...`; const uploadObs = this.selectedFiles.map(file => this.apiService.getUploadUrl(file.name, file.type, 'templates').pipe(switchMap(res => this.apiService.uploadFile(res.url, file)), filter(event => event.type === HttpEventType.Response), map(() => file.name))); forkJoin(uploadObs).pipe(catchError(err => { this.statusMessage = 'Error during upload.'; this.isGenerating = false; return of(null); })).subscribe(filenames => { if (filenames) { this.statusMessage = 'Triggering AI template generation...'; this.apiService.createTemplateFromSamples(this.newTemplateName, this.newTemplateDescription, filenames).subscribe({ next: () => { this.statusMessage = 'Template generated successfully!'; this.isGenerating = false; setTimeout(() => { this.newTemplateName = ''; this.newTemplateDescription = ''; this.selectedFiles = []; this.statusMessage = ''; this.loadTemplates(); }, 2000); }, error: (err: any) => { this.statusMessage = `AI generation failed: ${err.message}`; this.isGenerating = false; } }); } }); }
}
EOF

# Template Editor Page
tee src/app/pages/template-editor/template-editor.component.ts > /dev/null <<'EOF'
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { ApiService } from '../../services/api.service';
@Component({
  selector: 'app-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MarkdownModule],
  templateUrl: './template-editor.html',
  styleUrls: ['./template-editor.css']
})
export class TemplateEditorComponent implements OnInit {
  templateDoc: any = null;
  editableTemplateText = '';
  templateId: string | null = null;
  activeTab: 'editor' | 'preview' = 'editor';
  isLoading = true;
  isSaving = false;
  statusMessage = '';
  errorMessage = '';
  constructor(private route: ActivatedRoute, private apiService: ApiService) {}
  ngOnInit(): void { this.templateId = this.route.snapshot.paramMap.get('id'); if (this.templateId) { this.loadTemplateContent(); } else { this.errorMessage = "No ID found."; this.isLoading = false; } }
  loadTemplateContent(): void { if (!this.templateId) return; this.isLoading = true; this.apiService.getTemplateContent(this.templateId).subscribe({ next: (data) => { this.templateDoc = data.metadata; this.editableTemplateText = data.markdownContent; this.isLoading = false; }, error: (err) => { this.errorMessage = `Failed to load template: ${err.message}`; this.isLoading = false; } }); }
  saveTemplate(): void { if (!this.templateId || !this.editableTemplateText) return; this.isSaving = true; this.statusMessage = 'Saving...'; this.apiService.updateTemplate(this.templateId, this.editableTemplateText).subscribe({ next: () => { this.isSaving = false; this.statusMessage = 'Saved!'; setTimeout(() => this.statusMessage = '', 3000); }, error: (err: any) => { this.isSaving = false; this.statusMessage = `Error: ${err.message}`; } }); }
}
EOF

# Settings Page
tee src/app/pages/settings/settings.component.ts > /dev/null <<'EOF'
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { forkJoin } from 'rxjs';
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.css']
})
export class SettingsComponent implements OnInit {
  settings: any = {};
  prompts: any[] = [];
  templates: any[] = [];
  isLoading = true;
  isSaving = false;
  statusMessage = '';
  constructor(private apiService: ApiService) {}
  ngOnInit(): void { this.loadData(); }
  loadData(): void { this.isLoading = true; forkJoin({ settings: this.apiService.getSettings(), prompts: this.apiService.getPrompts(), templates: this.apiService.getTemplates() }).subscribe({ next: (data) => { this.settings = data.settings; this.prompts = data.prompts; this.templates = data.templates; this.isLoading = false; }, error: (err) => { this.statusMessage = `Error loading data: ${err.message}`; this.isLoading = false; } }); }
  saveSettings(): void { this.isSaving = true; this.statusMessage = 'Saving...'; this.apiService.updateSettings(this.settings).subscribe({ next: () => { this.isSaving = false; this.statusMessage = 'Settings saved!'; setTimeout(() => this.statusMessage = '', 3000); }, error: (err: any) => { this.isSaving = false; this.statusMessage = `Error: ${err.message}`; } }); }
}
EOF

# Prompt Manager Page
tee src/app/pages/prompt-manager/prompt-manager.component.ts > /dev/null <<'EOF'
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
@Component({
  selector: 'app-prompt-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prompt-manager.html',
  styleUrls: ['./prompt-manager.css']
})
export class PromptManagerComponent implements OnInit {
  prompts: any[] = [];
  selectedPromptId = '';
  editablePromptText = '';
  originalPromptText = '';
  isLoadingList = true;
  isLoadingPrompt = false;
  isSaving = false;
  statusMessage = '';
  constructor(private apiService: ApiService) {}
  ngOnInit(): void { this.apiService.getPrompts().subscribe({ next: (data) => { this.prompts = data; this.isLoadingList = false; }, error: (err: any) => { this.statusMessage = `Error loading prompts: ${err.message}`; this.isLoadingList = false; } }); }
  onPromptSelected(): void { if (!this.selectedPromptId) { this.editablePromptText = ''; this.originalPromptText = ''; return; } this.isLoadingPrompt = true; this.statusMessage = 'Loading...'; this.apiService.getPrompt(this.selectedPromptId).subscribe({ next: (data) => { this.editablePromptText = data.prompt_text; this.originalPromptText = data.prompt_text; this.isLoadingPrompt = false; this.statusMessage = ''; }, error: (err: any) => { this.editablePromptText = `Failed to load: ${err.message}`; this.isLoadingPrompt = false; } }); }
  savePrompt(): void { if (!this.selectedPromptId || this.isSaving) return; this.isSaving = true; this.statusMessage = 'Saving...'; this.apiService.updatePrompt(this.selectedPromptId, this.editablePromptText).subscribe({ next: () => { this.isSaving = false; this.statusMessage = 'Saved!'; this.originalPromptText = this.editablePromptText; setTimeout(() => this.statusMessage = '', 3000); }, error: (err: any) => { this.isSaving = false; this.statusMessage = `Error: ${err.message}`; } }); }
  isPristine(): boolean { return this.editablePromptText === this.originalPromptText; }
}
EOF

echo
echo "--------------------------------------------------------"
echo " SUCCESS: All remaining TypeScript files populated."
echo "--------------------------------------------------------"
echo