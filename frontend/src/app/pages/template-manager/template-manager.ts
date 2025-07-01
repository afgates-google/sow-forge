import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-template-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './template-manager.html',
  styleUrls: ['./template-manager.css']
})
export class TemplateManagerComponent implements OnInit {
  templates: any[] = [];
  
  newTemplateName = '';
  newTemplateDescription = '';
  stagedFiles: File[] = [];
  isCreating = false;

  editingTemplateId: string | null = null;
  templateNameBeforeEdit = '';

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

  // --- Methods for creating a new template ---
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.stagedFiles.push(...Array.from(input.files));
      input.value = '';
    }
  }

  removeStagedFile(index: number): void {
    this.stagedFiles.splice(index, 1);
  }

  // THIS IS THE CORRECTED METHOD
  createTemplate(): void {
    if (!this.newTemplateName || this.stagedFiles.length === 0 || this.isCreating) {
      return;
    }
    this.isCreating = true;

    // Step 1: Get a signed URL for each sample file.
    const uploadObservables = this.stagedFiles.map(file => 
      this.apiService.getUploadUrl(file.name, file.type, 'templates')
    );

    // Step 2: Once all URLs are fetched, upload the files to GCS.
    forkJoin(uploadObservables).pipe(
      switchMap((responses: any[]) => {
        const uploadPromises = responses.map((res, index) => 
          fetch(res.signedUrl, { // Use the 'signedUrl' property
            method: 'PUT',
            headers: { 'Content-Type': this.stagedFiles[index].type },
            body: this.stagedFiles[index]
          })
        );
        const gcsPaths = responses.map(res => res.gcsPath);
        return Promise.all(uploadPromises).then(() => gcsPaths);
      }),
      // Step 3: Once all files are uploaded, call the function to generate the template.
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
        this.loadTemplates(); // Refresh the list to show the new template
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

  // --- Methods to handle inline renaming of existing templates ---
  startTemplateNameEdit(template: any, event: MouseEvent): void {
    event.stopPropagation();
    this.editingTemplateId = template.id;
    this.templateNameBeforeEdit = template.name;
  }

  cancelTemplateNameEdit(template: any): void {
    template.name = this.templateNameBeforeEdit;
    this.editingTemplateId = null;
  }

  saveTemplateName(template: any): void {
    if (template.name === this.templateNameBeforeEdit) {
      this.editingTemplateId = null;
      return;
    }
    // This is the correct usage for the update/rename action.
    this.apiService.updateTemplate(template.id, { name: template.name }).subscribe(() => {
      this.editingTemplateId = null;
    });
  }
}