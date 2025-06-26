import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown'; // <-- IMPORT

@Component({
  selector: 'app-prompt-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownModule], // <-- ADD MarkdownModule
  // Note: The template URL was changed in the provided snippet, ensure it matches your actual file name.
  templateUrl: './prompt-manager.html',
  styleUrls: ['./prompt-manager.css']
})
export class PromptManagerComponent implements OnInit {
  prompts: any[] = [];
  selectedPromptId: string | null = null;
  
  // State management properties
  isLoadingList = true;
  isLoadingPrompt = false;
  isSaving = false;
  
  // Text editing properties
  editablePromptText: string = '';
  originalPromptText: string = ''; // To track changes
  
  activeTab: 'write' | 'preview' = 'write'; // <-- NEW property for tabs
  
  statusMessage: string = '';

  constructor(private apiService: ApiService) { }

  ngOnInit(): void {
    this.apiService.getPrompts().subscribe(data => {
      this.prompts = data;
      this.isLoadingList = false;
      if (this.prompts.length > 0) {
        this.selectedPromptId = this.prompts[0].id;
        this.loadPrompt();
      }
    });
  }

  // Renamed from 'loadPrompt' to match the HTML (change) event
  onPromptSelected(): void {
    this.activeTab = 'write'; // Reset to write tab when changing prompt
    if (!this.selectedPromptId) {
      this.editablePromptText = '';
      this.originalPromptText = '';
      return;
    }
    this.loadPrompt();
  }
  
  loadPrompt(): void {
    if (!this.selectedPromptId) return;

    this.isLoadingPrompt = true;
    this.statusMessage = 'Loading...';
    
    this.apiService.getPromptDetails(this.selectedPromptId).subscribe(data => {
      this.editablePromptText = data.prompt_text;
      this.originalPromptText = data.prompt_text; // Set original text
      this.isLoadingPrompt = false;
      this.statusMessage = '';
    });
  }

  savePrompt(): void {
    if (!this.selectedPromptId || this.isPristine() || this.isSaving) return;

    this.isSaving = true;
    this.statusMessage = 'Saving...';
    
    this.apiService.updatePrompt(this.selectedPromptId, this.editablePromptText).subscribe(() => {
      this.originalPromptText = this.editablePromptText; // Update original text
      this.statusMessage = `Saved successfully at ${new Date().toLocaleTimeString()}`;
      this.isSaving = false;
      setTimeout(() => this.statusMessage = '', 3000);
    });
  }

  // Getter to check if the prompt text has been changed
  isPristine(): boolean {
    return this.editablePromptText === this.originalPromptText;
  }
}