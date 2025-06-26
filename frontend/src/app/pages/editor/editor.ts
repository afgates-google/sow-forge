import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router'; // <-- Added RouterModule
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown'; // <-- Added MarkdownModule

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MarkdownModule], // <-- CORRECTED imports
  templateUrl: './editor.html',
  styleUrls: ['./editor.css']
})
export class EditorComponent implements OnInit {
  // --- Component State ---
  project: any = null;
  projectId!: string;
  
  editableSowText: string = 'Loading SOW content...';
  originalSowText: string = '';

  isSaving = false;
  isCreatingGDoc = false;
  statusMessage: string = '';
  
  activeTab: 'write' | 'preview' = 'write'; // <-- CRITICAL FIX: Added this missing property

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/history']);
      return;
    }
    this.projectId = id;
    this.loadSowContent();
  }

  loadSowContent(): void {
    this.apiService.getProjectDetails(this.projectId).subscribe({
      next: (data) => {
        this.project = data;
        this.editableSowText = data.generatedSowText || '# Statement of Work\n\n*No content has been generated for this project yet.*';
        this.originalSowText = this.editableSowText;
      },
      error: (err) => {
        this.statusMessage = `Error: Could not load project ${this.projectId}.`;
        console.error(err);
      }
    });
  }

  get isDirty(): boolean {
    return this.editableSowText !== this.originalSowText;
  }

  saveSow(): void {
    if (!this.isDirty || this.isSaving) {
      return;
    }
    this.isSaving = true;
    this.statusMessage = "Saving...";
    this.apiService.updateProject(this.projectId, { generatedSowText: this.editableSowText }).subscribe({
      next: () => {
        this.originalSowText = this.editableSowText;
        this.statusMessage = `Saved successfully at ${new Date().toLocaleTimeString()}`;
        setTimeout(() => this.statusMessage = '', 3000);
      },
      error: (err) => {
        this.statusMessage = "Save failed. Please try again.";
        console.error("Failed to save SOW:", err);
      },
      complete: () => {
        this.isSaving = false;
      }
    });
  }

  createGoogleDoc(): void {
    if (this.isCreatingGDoc) {
      return;
    }
    this.isCreatingGDoc = true;
    this.statusMessage = "Creating Google Doc...";
    this.apiService.createGoogleDoc(this.projectId).subscribe({
      next: (response) => {
        this.statusMessage = "Google Doc created successfully!";
        if (this.project) {
          this.project.google_doc_url = response.doc_url;
        }
        window.open(response.doc_url, '_blank');
        setTimeout(() => this.statusMessage = '', 3000);
      },
      error: (err) => {
        this.statusMessage = "Failed to create Google Doc.";
        console.error("Failed to create Google Doc:", err);
      },
      complete: () => {
        this.isCreatingGDoc = false;
      }
    });
  }
}