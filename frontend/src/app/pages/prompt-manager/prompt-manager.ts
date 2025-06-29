import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-prompt-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prompt-manager.html',
  styleUrls: ['./prompt-manager.css']
})
export class PromptManagerComponent implements OnInit {
  prompts: any[] = [];
  selectedPromptId: string | null = null;
  
  isLoadingList = true;
  isLoadingPrompt = false;
  isSaving = false;
  
  editablePromptText: string = '';
  originalPromptText: string = '';
  
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

  // THIS IS THE FIRST FIX
  savePromptContent(): void {
    if (!this.selectedPromptId || this.isPristine() || this.isSaving) return;

    this.isSaving = true;
    this.statusMessage = 'Saving...';
    
    // Pass an object with the 'prompt_text' key
    const updateData = { prompt_text: this.editablePromptText };
    
    this.apiService.updatePrompt(this.selectedPromptId, updateData).subscribe({
      next: () => {
        this.originalPromptText = this.editablePromptText;
        this.statusMessage = `Content saved successfully at ${new Date().toLocaleTimeString()}`;
        setTimeout(() => this.statusMessage = '', 3000);
      },
      error: (err: any) => { this.statusMessage = 'Save failed!'; console.error(err); },
      complete: () => { this.isSaving = false; }
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

  // THIS IS THE SECOND FIX
  savePromptName(prompt: any): void {
    if (prompt.name === this.promptNameBeforeEdit) {
      this.editingPromptId = null;
      return;
    }
    // Call the unified 'updatePrompt' method, passing an object with the 'name' key
    this.apiService.updatePrompt(prompt.id, { name: prompt.name }).subscribe(() => {
      this.editingPromptId = null;
    });
  }
}