// In frontend/src/app/pages/editor/editor.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';
import { LoggingService } from '../../services/logging.service';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MarkdownModule],
  templateUrl: './editor.html',
  styleUrls: ['./editor.css']
})
export class EditorComponent implements OnInit {
  project: any = null;
  sow: any = null;
  
  editableSowText: string = 'Loading SOW content...';
  originalSowText: string = '';

  isSaving = false;
  isCreatingGDoc = false;
  statusMessage: string = '';
  
  activeTab: 'write' | 'preview' = 'write';

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private logger: LoggingService
  ) {}

  ngOnInit(): void {
    // Correctly read all parameters from the route
    const projectId = this.route.snapshot.paramMap.get('projectId');
    const sowId = this.route.snapshot.paramMap.get('sowId');

    if (!projectId || !sowId) {
      this.editableSowText = 'Error: Project or SOW ID missing from URL.';
      return;
    }

    this.apiService.getGeneratedSowDetails(projectId, sowId).subscribe({
      next: (data) => {
        this.logger.log("Received SOW details from API:", data); // For debugging
        this.project = data.project;
        this.sow = data.sow;
        this.editableSowText = data.sow?.generatedSowText || '# SOW Content Not Found';
        this.originalSowText = this.editableSowText;
      },
      error: (err: any) => {
        // Log the full error to the console for easier debugging
        this.logger.error("API Error fetching SOW details:", err);
        this.statusMessage = `Error: Could not load SOW. ${err.error?.message || err.message}`;
      }
    });
  }

  get isDirty(): boolean {
    return this.editableSowText !== this.originalSowText;
  }

  saveSow(): void {
    alert('Save functionality is not yet implemented for this editor.');
  }

  createGoogleDoc(): void {
    if (this.isCreatingGDoc || !this.project || !this.sow) return;

    this.isCreatingGDoc = true;
    this.statusMessage = "Creating Google Doc...";

    this.apiService.createGoogleDocForSow(this.project.id, this.sow.id).subscribe({
        next: (response: any) => {
            this.statusMessage = "Google Doc created successfully!";
            this.sow.googleDocUrl = response.doc_url;
            window.open(response.doc_url, '_blank');
            setTimeout(() => this.statusMessage = '', 3000);
        },
        error: (err: any) => {
            this.statusMessage = "Failed to create Google Doc.";
            this.logger.error(err);
        },
        complete: () => {
            this.isCreatingGDoc = false;
        }
    });
  }
}
