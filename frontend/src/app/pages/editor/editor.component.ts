import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { ApiService } from '../../services/api.service';
@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MarkdownModule],
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css']
})
export class EditorComponent implements OnInit {
  sowDocument: any = null;
  docId: string | null = null;
  editableSowText = '';
  isLoading = true;
  isSaving = false;
  isCreatingDoc = false;
  errorMessage = '';
  saveStatusMessage = '';
  activeTab: 'editor' | 'preview' = 'editor';
  constructor(private route: ActivatedRoute, private apiService: ApiService) {}
  ngOnInit(): void {
    this.docId = this.route.snapshot.paramMap.get('id');
    if (this.docId) {
      this.apiService.getAnalysisResults(this.docId).subscribe({
        next: (data) => {
          this.sowDocument = data;
          this.editableSowText = data.generated_sow || 'SOW has not been generated for this document yet.';
          this.isLoading = false;
        },
        error: (err) => { this.errorMessage = `Error fetching document: ${err.message}`; this.isLoading = false; }
      });
    } else {
      this.errorMessage = 'No document ID provided in the URL.';
      this.isLoading = false;
    }
  }
  saveSow(): void {
    if (!this.docId || !this.editableSowText) return;
    this.isSaving = true;
    this.saveStatusMessage = 'Saving...';
    this.apiService.updateDocument(this.docId, { generated_sow: this.editableSowText }).subscribe({
      next: () => { this.isSaving = false; this.saveStatusMessage = 'SOW saved successfully!'; setTimeout(() => this.saveStatusMessage = '', 3000); },
      error: (err: any) => { this.isSaving = false; this.saveStatusMessage = `Error saving SOW: ${err.message}`; }
    });
  }
  openInGoogleDocs(): void {
    if (!this.docId) return;
    if (this.sowDocument && this.sowDocument.google_doc_url) { window.open(this.sowDocument.google_doc_url, '_blank'); return; }
    this.isCreatingDoc = true;
    this.saveStatusMessage = 'Creating Google Doc...';
    this.apiService.createGoogleDoc(this.docId).subscribe({
      next: (response: any) => {
        this.isCreatingDoc = false;
        this.saveStatusMessage = 'Document created successfully!';
        this.sowDocument.google_doc_url = response.doc_url; 
        window.open(response.doc_url, '_blank');
        setTimeout(() => this.saveStatusMessage = '', 3000);
      },
      error: (err: any) => { this.isCreatingDoc = false; this.saveStatusMessage = `Error creating document: ${err.message}`; }
    });
  }
}
