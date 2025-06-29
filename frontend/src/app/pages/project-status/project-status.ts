import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Subscription, timer, switchMap, takeWhile } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-project-status',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule], // Ensures *ngIf, ngModel, and routerLink work
  templateUrl: './project-status.html',
  styleUrls: ['./project-status.css']
})
export class ProjectStatusComponent implements OnInit, OnDestroy {
  // --- Component State ---
  project: any = null;
  templates: any[] = [];
  selectedTemplateId: string | null = null;
  isAnalysisComplete = false;
  isGenerating = false;
  errorMessage: string | null = null;
  isLoading = true; // For the main page load indicator

  private pollingSubscription?: Subscription;
  private projectId!: string;

  // For the category dropdown
  documentCategories = [
    'General', 
    'Legislative / Legal', 
    'Business / Process', 
    'Technical / Architectural', 
    'Financial / Budgetary', 
    'Security / Compliance',
    'Project Plan / Schedule'
  ];
  
  // For inline editing state
  isEditingProjectName = false;
  projectNameBeforeEdit = '';
  editingDocId: string | null = null;
  docNameBeforeEdit = '';
  // Add these properties to the top of the ProjectStatusComponent class
  editingSowId: string | null = null;
  sowNameBeforeEdit = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    
  this.projectId = this.route.snapshot.paramMap.get('projectId')!; // <-- CORRECTED
    if (!this.projectId) {
      this.errorMessage = "Project ID is missing from the URL.";
      this.isLoading = false;
      return;
    }
    this.startPolling();
    this.loadTemplates();
  }

  startPolling(): void {
    this.pollingSubscription = timer(0, 5000) // Poll every 5 seconds
      .pipe(
        switchMap(() => this.apiService.getProjectDetails(this.projectId)),
        takeWhile(() => !this.isAnalysisComplete, true)
      )
      .subscribe({
        next: (data) => {
          console.log('Successfully fetched project data:', data);
          this.project = data;
          this.isLoading = false; // Data has loaded
          this.checkAnalysisStatus();
        },
        error: (err) => {
          console.error('ERROR fetching project details:', err);
          this.errorMessage = "Could not fetch project details.";
          this.isLoading = false;
          this.pollingSubscription?.unsubscribe();
        }
      });
  }

  loadProjectDetails(): void {
    this.isLoading = true;
    this.apiService.getProjectDetails(this.projectId).subscribe(data => {
      this.project = data;
      this.isLoading = false;
      this.checkAnalysisStatus();
    });
  }

  checkAnalysisStatus(): void {
    if (this.project?.sourceDocuments) {
      const allAnalyzed = this.project.sourceDocuments.every(
        (doc: any) => doc.status === 'ANALYZED_SUCCESS' || doc.status === 'ANALYSIS_FAILED'
      );
      if (allAnalyzed) {
        this.isAnalysisComplete = true;
        this.project.status = 'ANALYSIS_COMPLETE';
        this.pollingSubscription?.unsubscribe();
      }
    }
  }

  loadTemplates(): void {
    this.apiService.getTemplates().subscribe(data => {
      this.templates = data;
      if (this.templates.length > 0) {
        this.selectedTemplateId = this.templates[0].id;
      }
    });
  }

  triggerSowGeneration(): void {
    if (!this.selectedTemplateId || !this.projectId) return;
    this.isGenerating = true;
    // The generateSow function now returns the new SOW's ID
    this.apiService.generateSow(this.projectId, this.selectedTemplateId).subscribe({
      next: (response: any) => {
        this.isGenerating = false;
        // Navigate directly to the new SOW's editor page
        this.router.navigate(['/projects', this.projectId, 'sows', response.sowId, 'editor']);
      },
      error: (err) => {
        this.isGenerating = false;
        // Use the error message from the backend if available
        const errorMessage = err.error?.message || 'SOW Generation Failed.';
        alert(errorMessage);
        console.error(err);
      }
    });
  }

  // --- Inline Editing and Action Methods ---

  startProjectNameEdit(): void {
    this.projectNameBeforeEdit = this.project.projectName;
    this.isEditingProjectName = true;
  }

  cancelProjectNameEdit(): void {
    this.project.projectName = this.projectNameBeforeEdit;
    this.isEditingProjectName = false;
  }

  saveProjectName(): void {
    if (this.project.projectName === this.projectNameBeforeEdit) {
      this.isEditingProjectName = false;
      return;
    }
    this.apiService.updateProject(this.projectId, { projectName: this.project.projectName }).subscribe(() => {
      this.isEditingProjectName = false;
    });
  }

  startDocNameEdit(doc: any): void {
    this.editingDocId = doc.id;
    this.docNameBeforeEdit = doc.displayName;
  }

  cancelDocNameEdit(doc: any): void {
    doc.displayName = this.docNameBeforeEdit;
    this.editingDocId = null;
  }

  saveDocChanges(doc: any): void {
    this.apiService.updateSourceDocument(this.projectId, doc.id, { 
      displayName: doc.displayName,
      category: doc.category 
    }).subscribe(() => {
      this.editingDocId = null; // Exit edit mode
      // Ask user if they want to re-analyze after changing the category
      if (confirm('Category has been changed. Do you want to re-analyze this document now to apply the new logic?')) {
        this.triggerRegenerate(doc);
      }
    });
  }

  triggerRegenerate(doc: any): void {
    if (confirm(`Are you sure you want to re-analyze the document "${doc.displayName}"?`)) {
      doc.status = 'RE_ANALYZING'; // Optimistic UI update
      this.apiService.regenerateAnalysis(this.projectId, doc.id).subscribe({
        next: () => {
          console.log(`Regeneration successfully triggered for doc ${doc.id}`);
          // Re-start polling if it had stopped
          this.isAnalysisComplete = false;
          if (!this.pollingSubscription || this.pollingSubscription.closed) {
            this.startPolling();
          }
        },
        error: (err) => {
          console.error('Failed to trigger regeneration', err);
          alert('Could not trigger re-analysis.');
          this.loadProjectDetails(); // Re-fetch state on error
        }
      });
    }
  }

  startSowNameEdit(sow: any): void {
    this.editingSowId = sow.id;
    this.sowNameBeforeEdit = sow.templateName;
  }

  cancelSowNameEdit(sow: any): void {
    if (this.editingSowId === sow.id) {
      sow.templateName = this.sowNameBeforeEdit;
      this.editingSowId = null;
    }
  }

  saveSowName(sow: any): void {
    if (!this.editingSowId || sow.templateName.trim() === '') {
      this.cancelSowNameEdit(sow);
      return;
    }

    if (sow.templateName === this.sowNameBeforeEdit) {
        this.editingSowId = null;
        return;
    }

    this.apiService.updateGeneratedSow(this.projectId, sow.id, { templateName: sow.templateName }).subscribe({
      next: () => {
        console.log('SOW name updated successfully.');
        this.editingSowId = null;
      },
      error: (err: any) => {
        alert('Failed to update SOW name.');
        console.error(err);
        this.cancelSowNameEdit(sow);
      }
    });
  }

  // Add this method inside the ProjectStatusComponent class

  deleteSow(sowToDelete: any): void {
    const sowName = sowToDelete.templateName || 'this SOW';
    if (confirm(`Are you sure you want to delete "${sowName}"? This action cannot be undone.`)) {
      this.apiService.deleteGeneratedSow(this.projectId, sowToDelete.id).subscribe({
        next: () => {
          // For an immediate UI update, filter the deleted SOW out of the local array
          this.project.generatedSows = this.project.generatedSows.filter((sow: any) => sow.id !== sowToDelete.id);
          console.log('SOW deleted successfully from the UI.');
        },
        error: (err: any) => {
          alert('Failed to delete SOW. Please check the console.');
          console.error(err);
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.pollingSubscription?.unsubscribe();
  }
}