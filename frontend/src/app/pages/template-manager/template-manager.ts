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
