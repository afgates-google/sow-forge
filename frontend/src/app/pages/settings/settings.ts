import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TitleCasePipe],
  templateUrl: './settings.html',
  styleUrls: ['./settings.css']
})
export class SettingsComponent implements OnInit {
  settings: any = null;
  statusMessage = '';
  
  // NEW: Property to manage which tab is currently visible
  activeTab: string = 'general';
  
  // For the prompt_mapping editor
  promptMappingArray: { key: string; value: string }[] = [];
  
  // NEW: List of available Vertex AI models for dropdowns
  availableModels: string[] = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash'
  ];

  constructor(private apiService: ApiService) { }

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.apiService.getSettings().subscribe(data => {
      this.settings = data;
      if (this.settings && this.settings.prompt_mapping) {
        this.promptMappingArray = Object.keys(this.settings.prompt_mapping).map(key => {
          return { key: key, value: this.settings.prompt_mapping[key] };
        });
      }
    });
  }

  saveSettings(): void {
    if (!this.settings) return;

    // Convert the array back to a map before saving
    const newPromptMap: { [key: string]: string } = {};
    this.promptMappingArray.forEach(item => {
      newPromptMap[item.key] = item.value;
    });
    this.settings.prompt_mapping = newPromptMap;

    this.statusMessage = 'Saving...';
    this.apiService.updateSettings(this.settings).subscribe(() => {
      this.statusMessage = `Settings saved successfully at ${new Date().toLocaleTimeString()}`;
      setTimeout(() => this.statusMessage = '', 3000);
    });
  }
}