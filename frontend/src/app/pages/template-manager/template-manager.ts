import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

@Component({
  selector: 'app-template-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './template-manager.html',
  styleUrls: ['./template-manager.css']
})
export class TemplateManagerComponent implements OnInit {
  templates: any[] = [];
  
  // State for new template creation
  newTemplateName = '';
  newTemplateDescription = '';
  stagedFiles: File[] = [];
  isCreating = false;

  constructor(private apiService: ApiService, private router: Router) { }

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.apiService.getTemplates().subscribe(data => {
      this.templates = data;
    });
  }

  deleteTemplate(templateId: string, templateName: string): void {
    if (confirm(`Are you sure you want to delete the template "${templateName}"?`)) {
      this.apiService.deleteTemplate(templateId).subscribe(() => {
        this.loadTemplates(); // Refresh the list
      });
    }
  }

  // --- New Template Creation Logic ---
  
  onFileSelected(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (files) {
      this.stagedFiles.push(...Array.from(files));
    }
  }

  removeStagedFile(index: number): void {
    this.stagedFiles.splice(index, 1);
  }

  createTemplate(): void {
    if (!this.newTemplateName || this.stagedFiles.length === 0 || this.isCreating) {
      return;
    }
    this.isCreating = true;

    // Step 1: Get signed URLs for all staged files
    const uploadObservables = this.stagedFiles.map(file => 
      this.apiService.getUploadUrl(file.name, file.type, 'templates')
    );

    forkJoin(uploadObservables).pipe(
      // Step 2: Upload the files to GCS
      switchMap((responses: any[]) => {
        const uploadPromises = responses.map((res, index) => 
          fetch(res.url, { method: 'PUT', body: this.stagedFiles[index] })
        );
        // We also need the GCS paths for the next step
        const gcsPaths = responses.map(res => res.gcsPath);
        return Promise.all(uploadPromises).then(() => gcsPaths); // Pass paths to the next step
      }),
      // Step 3: Trigger the backend template generation function
      switchMap((gcsPaths: string[]) => {
        return this.apiService.createTemplateFromSamples(
          this.newTemplateName, 
          this.newTemplateDescription, 
          gcsPaths
        );
      })
    ).subscribe({
      next: (result) => {
        alert(`Template "${this.newTemplateName}" created successfully!`);
        this.isCreating = false;
        this.resetForm();
        this.loadTemplates();
      },
      error: (err) => {
        alert('Failed to create template. Please check the console.');
        console.error(err);
        this.isCreating = false;
      }
    });
  }

  resetForm(): void {
    this.newTemplateName = '';
    this.newTemplateDescription = '';
    this.stagedFiles = [];
  }
}