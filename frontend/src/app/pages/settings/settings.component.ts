import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { forkJoin } from 'rxjs';
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.css']
})
export class SettingsComponent implements OnInit {
  settings: any = {};
  prompts: any[] = [];
  templates: any[] = [];
  isLoading = true;
  isSaving = false;
  statusMessage = '';
  constructor(private apiService: ApiService) {}
  ngOnInit(): void { this.loadData(); }
  loadData(): void { this.isLoading = true; forkJoin({ settings: this.apiService.getSettings(), prompts: this.apiService.getPrompts(), templates: this.apiService.getTemplates() }).subscribe({ next: (data) => { this.settings = data.settings; this.prompts = data.prompts; this.templates = data.templates; this.isLoading = false; }, error: (err) => { this.statusMessage = `Error loading data: ${err.message}`; this.isLoading = false; } }); }
  saveSettings(): void { this.isSaving = true; this.statusMessage = 'Saving...'; this.apiService.updateSettings(this.settings).subscribe({ next: () => { this.isSaving = false; this.statusMessage = 'Settings saved!'; setTimeout(() => this.statusMessage = '', 3000); }, error: (err: any) => { this.isSaving = false; this.statusMessage = `Error: ${err.message}`; } }); }
}
