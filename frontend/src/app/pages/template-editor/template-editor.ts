import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-editor.html',
  styleUrls: ['./template-editor.css']
})
export class TemplateEditorComponent implements OnInit {
  templateId!: string;
  templateDoc: any = null;
  editableContent = '';
  statusMessage = '';

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
    this.apiService.updateTemplate(this.templateId, this.editableContent).subscribe(() => {
      this.statusMessage = `Saved successfully at ${new Date().toLocaleTimeString()}`;
    });
  }
}