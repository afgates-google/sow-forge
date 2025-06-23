import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
@Component({
  selector: 'app-prompt-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prompt-manager.html',
  styleUrls: ['./prompt-manager.css']
})
export class PromptManagerComponent implements OnInit {
  prompts: any[] = [];
  selectedPromptId = '';
  editablePromptText = '';
  originalPromptText = '';
  isLoadingList = true;
  isLoadingPrompt = false;
  isSaving = false;
  statusMessage = '';
  constructor(private apiService: ApiService) {}
  ngOnInit(): void { this.apiService.getPrompts().subscribe({ next: (data) => { this.prompts = data; this.isLoadingList = false; }, error: (err: any) => { this.statusMessage = `Error loading prompts: ${err.message}`; this.isLoadingList = false; } }); }
  onPromptSelected(): void { if (!this.selectedPromptId) { this.editablePromptText = ''; this.originalPromptText = ''; return; } this.isLoadingPrompt = true; this.statusMessage = 'Loading...'; this.apiService.getPrompt(this.selectedPromptId).subscribe({ next: (data) => { this.editablePromptText = data.prompt_text; this.originalPromptText = data.prompt_text; this.isLoadingPrompt = false; this.statusMessage = ''; }, error: (err: any) => { this.editablePromptText = `Failed to load: ${err.message}`; this.isLoadingPrompt = false; } }); }
  savePrompt(): void { if (!this.selectedPromptId || this.isSaving) return; this.isSaving = true; this.statusMessage = 'Saving...'; this.apiService.updatePrompt(this.selectedPromptId, this.editablePromptText).subscribe({ next: () => { this.isSaving = false; this.statusMessage = 'Saved!'; this.originalPromptText = this.editablePromptText; setTimeout(() => this.statusMessage = '', 3000); }, error: (err: any) => { this.isSaving = false; this.statusMessage = `Error: ${err.message}`; } }); }
  isPristine(): boolean { return this.editablePromptText === this.originalPromptText; }
}
