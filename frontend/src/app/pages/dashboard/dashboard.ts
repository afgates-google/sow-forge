import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // <-- Make sure FormsModule is imported

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule], // <-- Make sure FormsModule is in imports
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  projects: any[] = [];
  isLoading = true;

  // --- NEW: Properties for inline editing ---
  editingProjectId: string | null = null;
  projectNameBeforeEdit = '';

  constructor(private apiService: ApiService, private router: Router) { }

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.isLoading = true;
    this.apiService.getProjects().subscribe({
      next: (data) => {
        this.projects = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error("Failed to load projects:", err);
        this.isLoading = false;
        // Optionally show an error message to the user
      }
    });
  }

  deleteProject(projectId: string, projectName: string): void {
    if (confirm(`Are you sure you want to delete the project "${projectName}"? This action cannot be undone.`)) {
      this.apiService.deleteProject(projectId).subscribe({
        next: () => {
          // Filter out the deleted project from the local array for immediate UI update
          this.projects = this.projects.filter(p => p.id !== projectId);
        },
        error: (err) => {
          alert('Failed to delete project. Please check the console.');
          console.error(err);
        }
      });
    }
  }

  // --- NEW: Methods for inline editing ---

  startProjectNameEdit(project: any, event: MouseEvent): void {
    event.stopPropagation(); // Prevents navigation when clicking the edit button
    this.editingProjectId = project.id;
    this.projectNameBeforeEdit = project.projectName;
  }

  cancelProjectNameEdit(project: any): void {
    project.projectName = this.projectNameBeforeEdit;
    this.editingProjectId = null;
  }

  saveProjectName(project: any): void {
    if (project.projectName === this.projectNameBeforeEdit) {
      this.editingProjectId = null;
      return;
    }
    // We already have a generic updateProject method in the ApiService
    this.apiService.updateProject(project.id, { projectName: project.projectName }).subscribe(() => {
      this.editingProjectId = null;
    });
  }
}