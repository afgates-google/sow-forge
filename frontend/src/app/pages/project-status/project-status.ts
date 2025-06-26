import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Subscription, timer, switchMap, takeWhile, tap } from 'rxjs'; // Import tap
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-project-status',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './project-status.html',
  styleUrls: ['./project-status.css']
})
export class ProjectStatusComponent implements OnInit, OnDestroy {
  project: any = null;
  templates: any[] = [];
  selectedTemplateId: string | null = null;
  isAnalysisComplete = false;
  isGenerating = false;
  errorMessage: string | null = null;
  
  isLoading = true; // <-- CRITICAL FIX: Added this missing property

  private pollingSubscription?: Subscription;
  private projectId!: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id')!;
    if (!this.projectId) {
      this.errorMessage = "Project ID is missing from the URL.";
      this.isLoading = false;
      return;
    }

    this.startPolling();
    this.loadTemplates();
  }

  startPolling() {
    this.pollingSubscription = timer(0, 5000)
      .pipe(
        // Set loading state at the beginning of each poll for the initial load
        tap(() => { if (this.isLoading) console.log("Fetching project details..."); }),
        switchMap(() => this.apiService.getProjectDetails(this.projectId)),
        takeWhile(() => !this.isAnalysisComplete, true)
      )
      .subscribe({
        next: (data) => {
          this.project = data;
          this.isLoading = false; // <-- CRITICAL FIX: Set loading to false after data arrives
          this.checkAnalysisStatus();
        },
        error: (err) => {
          this.errorMessage = "Could not fetch project details.";
          this.isLoading = false; // <-- CRITICAL FIX: Also set loading to false on error
          this.pollingSubscription?.unsubscribe();
        }
      });
  }

  checkAnalysisStatus() {
    if (this.project?.sourceDocuments) {
      const allAnalyzed = this.project.sourceDocuments.every(
        (doc: any) => doc.status === 'ANALYZED_SUCCESS'
      );
      if (allAnalyzed) {
        this.isAnalysisComplete = true;
        this.project.status = 'ANALYSIS_COMPLETE';
        this.pollingSubscription?.unsubscribe();
      }
    }
  }

  loadTemplates() {
    this.apiService.getTemplates().subscribe(data => {
      this.templates = data;
      if (this.templates.length > 0) {
        this.selectedTemplateId = this.templates[0].id;
      }
    });
  }

  triggerSowGeneration() {
    if (!this.selectedTemplateId || !this.projectId) return;

    this.isGenerating = true;
    this.apiService.generateSow(this.projectId, this.selectedTemplateId).subscribe({
      next: (generatedSow) => {
        this.isGenerating = false;
        this.router.navigate(['/projects', this.projectId, 'editor']);
      },
      error: (err) => {
        this.isGenerating = false;
        alert('SOW Generation Failed. Please check the console for details.');
        console.error(err);
      }
    });
  }

  // --- ADD THIS NEW METHOD ---
  regenerateAnalysis(document: any): void {
    // Prevent multiple clicks by setting a temporary state on the document object
    document.isRegenerating = true;

    this.apiService.regenerateAnalysis(this.projectId, document.id).subscribe({
      next: () => {
        // The backend has confirmed the trigger. Update the status locally for
        // instant UI feedback. The polling will handle the rest.
        document.status = 'RE_ANALYZING';
        document.isRegenerating = false; // Re-enable button in case of another retry
      },
      error: (err) => {
        alert(`Failed to trigger regeneration for "${document.originalFilename}". Please check the console.`);
        console.error(err);
        document.isRegenerating = false; // Re-enable button on error
      }
    });
  }

  ngOnDestroy(): void {
    this.pollingSubscription?.unsubscribe();
  }
}