import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown'; // <-- IMPORT

@Component({
  selector: 'app-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownModule], // <-- ADD MarkdownModule
  templateUrl: './template-editor.html',
  styleUrls: ['./template-editor.css']
})
export class TemplateEditorComponent implements OnInit {
  templateId!: string;
  templateDoc: any = null;
  editableContent = '';
  statusMessage = '';
  
  activeTab: 'write' | 'preview' = 'write'; // <-- NEW property for tabs

  constructor(private route: ActivatedRoute, private apiService: ApiService) { }

  ngOnInit(): void {
    this.templateId = this.route.snapshot.paramMap.get('id')!;
    this.loadTemplate();
  }

  loadTemplate(): void {
    this.apiService.getTemplateDetails(this.templateId).subscribe(data => {
      this.templateDoc = data.metadata;
      this.editableContent = data.markdownContent;
    });
  }

  saveTemplate(): void {
    this.statusMessage = 'Saving...';
    
    // --- THIS IS THE FIX ---
    // We now pass an object with the markdownContent property,
    // matching the new ApiService method signature.
    const updateData = { markdownContent: this.editableContent };
    
    this.apiService.updateTemplate(this.templateId, updateData).subscribe(() => {
      this.statusMessage = `Saved successfully at ${new Date().toLocaleTimeString()}`;
      setTimeout(() => this.statusMessage = '', 3000);
    });
  }
}