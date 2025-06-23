import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './results.html',
  styleUrls: ['./results.css']
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
    this.isGeneratingSow = true;
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
