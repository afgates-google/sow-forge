import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Subscription, timer, switchMap, takeWhile } from 'rxjs';
import { CommonModule } from '@angular/common'; // <-- IMPORT
import { FormsModule } from '@angular/forms'; // <-- IMPORT

@Component({
  selector: 'app-project-status',
  standalone: true, // <-- SET
  imports: [CommonModule, FormsModule],
  templateUrl: './project-status.html',
  styleUrls: ['./project-status.css'] // You can create a basic CSS file for this
})
export class ProjectStatusComponent implements OnInit, OnDestroy {
  project: any = null;
  templates: any[] = [];
  selectedTemplateId: string | null = null;
  isAnalysisComplete = false;
  isGenerating = false;
  errorMessage: string | null = null;
  
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
      return;
    }

    this.startPolling();
    this.loadTemplates();
  }

  startPolling() {
    this.pollingSubscription = timer(0, 5000) // Poll every 5 seconds
      .pipe(
        switchMap(() => this.apiService.getProjectDetails(this.projectId)),
        takeWhile(() => !this.isAnalysisComplete, true)
      )
      .subscribe({
        next: (data) => {
          this.project = data;
          this.checkAnalysisStatus();
        },
        error: (err) => {
          this.errorMessage = "Could not fetch project details.";
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
        // Generation successful, navigate to the editor page
        this.router.navigate(['/projects', this.projectId, 'editor']);
      },
      error: (err) => {
        this.isGenerating = false;
        alert('SOW Generation Failed. Please check the console for details.');
        console.error(err);
      }
    });
  }

  ngOnDestroy(): void {
    this.pollingSubscription?.unsubscribe();
  }
}