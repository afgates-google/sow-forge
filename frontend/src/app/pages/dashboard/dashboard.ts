import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common'; 

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  projects: any[] = [];
  isLoading = true;

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

  viewProject(projectId: string, status: string): void {
    if (status === 'SOW_GENERATED') {
      this.router.navigate(['/projects', projectId, 'editor']);
    } else {
      this.router.navigate(['/projects', projectId]);
    }
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
}