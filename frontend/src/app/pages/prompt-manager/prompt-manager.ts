import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown'; 

@Component({
  selector: 'app-prompt-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownModule],
  templateUrl: './prompt-manager.html', // <-- Ensure this filename is correct
  styleUrls: ['./prompt-manager.css']
})
export class PromptManagerComponent implements OnInit {
  prompts: any[] = [];
  selectedPromptId: string | null = null;
  
  // State for loading
  isLoadingList = true;
  isLoadingPrompt = false;
  isSaving = false;
  
  // State for content editing
  editablePromptText: string = '';
  originalPromptText: string = '';
  
  // State for inline name editing
  editingPromptId: string | null = null;
  promptNameBeforeEdit = '';

  statusMessage: string = '';

  constructor(private apiService: ApiService) { }

  ngOnInit(): void {
    this.apiService.getPrompts().subscribe(data => {
      this.prompts = data;
      this.isLoadingList = false;
    });
  }

  selectPrompt(promptId: string): void {
    if (this.editingPromptId) return;
    this.selectedPromptId = promptId;
    this.loadPromptContent();
  }

  // --- FIX: Renamed this method for clarity ---
  onPromptSelected(): void {
    if (!this.selectedPromptId) {
      this.editablePromptText = '';
      this.originalPromptText = '';
      return;
    }
    this.loadPromptContent();
  }

  loadPromptContent(): void {
    if (!this.selectedPromptId) return;

    this.isLoadingPrompt = true;
    this.statusMessage = 'Loading...';
    
    this.apiService.getPromptDetails(this.selectedPromptId).subscribe(data => {
      this.editablePromptText = data.prompt_text;
      this.originalPromptText = data.prompt_text;
      this.isLoadingPrompt = false;
      this.statusMessage = '';
    });
  }

  savePrompt(): void {
    if (!this.selectedPromptId || this.isPristine() || this.isSaving) return;

    this.isSaving = true;
    this.statusMessage = 'Saving...';
    
    this.apiService.updatePrompt(this.selectedPromptId, this.editablePromptText).subscribe({
      next: () => {
        this.originalPromptText = this.editablePromptText;
        this.statusMessage = `Content saved successfully at ${new Date().toLocaleTimeString()}`;
        this.isSaving = false;
        setTimeout(() => this.statusMessage = '', 3000);
      },
      error: (err) => { this.statusMessage = 'Save failed!'; this.isSaving = false; console.error(err); }
    });
  }

  isPristine(): boolean {
    return this.editablePromptText === this.originalPromptText;
  }

  // --- Methods for Inline Name Editing ---

  startPromptNameEdit(prompt: any, event: MouseEvent): void {
    event.stopPropagation();
    this.editingPromptId = prompt.id;
    this.promptNameBeforeEdit = prompt.name;
  }

  cancelPromptNameEdit(prompt: any): void {
    prompt.name = this.promptNameBeforeEdit;
    this.editingPromptId = null;
  }

  // --- FIX: Corrected method ---
  savePromptName(prompt: any): void {
    if (prompt.name === this.promptNameBeforeEdit) {
      this.editingPromptId = null;
      return;
    }
    // Now calls the correct, newly added method
    this.apiService.updatePromptDetails(prompt.id, { name: prompt.name }).subscribe(() => {
      this.editingPromptId = null;
    });
  }
}