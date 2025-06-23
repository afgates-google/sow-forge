import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { ApiService } from '../../services/api.service';
@Component({
  selector: 'app-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MarkdownModule],
  templateUrl: './template-editor.html',
  styleUrls: ['./template-editor.css']
})
export class TemplateEditorComponent implements OnInit {
  templateDoc: any = null;
  editableTemplateText = '';
  templateId: string | null = null;
  activeTab: 'editor' | 'preview' = 'editor';
  isLoading = true;
  isSaving = false;
  statusMessage = '';
  errorMessage = '';
  constructor(private route: ActivatedRoute, private apiService: ApiService) {}
  ngOnInit(): void { this.templateId = this.route.snapshot.paramMap.get('id'); if (this.templateId) { this.loadTemplateContent(); } else { this.errorMessage = "No ID found."; this.isLoading = false; } }
  loadTemplateContent(): void { if (!this.templateId) return; this.isLoading = true; this.apiService.getTemplateContent(this.templateId).subscribe({ next: (data) => { this.templateDoc = data.metadata; this.editableTemplateText = data.markdownContent; this.isLoading = false; }, error: (err) => { this.errorMessage = `Failed to load template: ${err.message}`; this.isLoading = false; } }); }
  saveTemplate(): void { if (!this.templateId || !this.editableTemplateText) return; this.isSaving = true; this.statusMessage = 'Saving...'; this.apiService.updateTemplate(this.templateId, this.editableTemplateText).subscribe({ next: () => { this.isSaving = false; this.statusMessage = 'Saved!'; setTimeout(() => this.statusMessage = '', 3000); }, error: (err: any) => { this.isSaving = false; this.statusMessage = `Error: ${err.message}`; } }); }
}
