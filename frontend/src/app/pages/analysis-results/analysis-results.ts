import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-analysis-results',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './analysis-results.html',
  styleUrls: ['./analysis-results.css']
})
export class AnalysisResultsComponent implements OnInit {
  document: any = null;
  isLoading = true;
  errorMessage = '';
  projectId: string = '';

  constructor(private route: ActivatedRoute, private apiService: ApiService) { }

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    const docId = this.route.snapshot.paramMap.get('docId');

    if (!projectId || !docId) {
      this.errorMessage = 'Project or Document ID is missing from the URL.';
      this.isLoading = false;
      return;
    }

    this.projectId = projectId;

    this.apiService.getSourceDocumentDetails(projectId, docId).subscribe({
      next: (data) => {
        this.document = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = `Failed to load analysis results. ${err.error?.message || err.message}`;
        this.isLoading = false;
        console.error(err);
      }
    });
  }
}