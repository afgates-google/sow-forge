import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TitleCasePipe], // <-- ADD TitleCasePipe
  templateUrl: './settings.html',
  styleUrls: ['./settings.css']
})
export class SettingsComponent implements OnInit {
  settings: any = null;
  statusMessage = '';
  objectKeys = Object.keys;

  constructor(private apiService: ApiService) { }

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.apiService.getSettings().subscribe(data => {
      this.settings = data;
    });
  }

  saveSettings(): void {
    if (!this.settings) return;
    this.statusMessage = 'Saving...';
    this.apiService.updateSettings(this.settings).subscribe(() => {
      this.statusMessage = `Settings saved successfully at ${new Date().toLocaleTimeString()}`;
    });
  }
  
  // New method to handle the label formatting safely
  formatLabel(key: string): string {
    return key.replace(/_/g, ' ');
  }
}