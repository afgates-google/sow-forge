import { Component, NgZone } from '@angular/core'; // <-- 1. IMPORT NgZone
import { ApiService } from '../../services/api.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface StagedFile {
  file: File;
  category: string;
  status: 'STAGED' | 'UPLOADING' | 'UPLOADED' | 'FAILED';
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './upload.html',
  styleUrls: ['./upload.css']
})
export class UploadComponent {
  projectName: string = '';
  stagedFiles: StagedFile[] = [];
  isCreating = false;
  
  documentCategories = [
    'General', 
    'Legislative / Legal', 
    'Business / Process', 
    'Technical / Architectural', 
    'Financial / Budgetary', 
    'Security / Compliance',
    'Project Plan / Schedule'
  ];

  constructor(
    private apiService: ApiService, 
    private router: Router,
    private zone: NgZone // <-- 2. INJECT NgZone
  ) {}

  // --- Methods for handling file selection (onDrop, onFileSelected, etc.) ---
  onDragOver(event: DragEvent) { event.preventDefault(); }
  onDragLeave(event: DragEvent) { event.preventDefault(); }
  onDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files) this.handleFiles(files);
  }
  onFileSelected(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (files) this.handleFiles(files);
  }
  private handleFiles(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      this.stagedFiles.push({ file: files[i], category: 'General', status: 'STAGED' });
    }
  }
  removeStagedFile(index: number) {
    this.stagedFiles.splice(index, 1);
  }

  /**
   * Orchestrates the entire project creation and upload flow.
   */
  createSowProject(): void {
    if (this.stagedFiles.length === 0 || !this.projectName || this.isCreating) {
      return;
    }
    this.isCreating = true;

    const fileMetadatas = this.stagedFiles.map(item => ({
      filename: item.file.name,
      category: item.category,
      contentType: item.file.type
    }));

    this.apiService.createProject(this.projectName, fileMetadatas).subscribe({
      next: (response) => {
        const { projectId, uploadInfo } = response;
        this.uploadAllFiles(projectId, uploadInfo);
      },
      error: (err) => {
        this.handleError('Could not create the SOW project structure.', err);
      }
    });
  }

  private uploadAllFiles(projectId: string, uploadInfo: any[]): void {
    const uploadPromises = uploadInfo.map(async (info: any) => {
      const stagedItem = this.stagedFiles.find(item => item.file.name === info.filename);
      if (!stagedItem) return;

      stagedItem.status = 'UPLOADING';
      await fetch(info.signedUrl, {
        method: 'PUT',
        headers: new Headers({ 'Content-Type': stagedItem.file.type }),
        body: stagedItem.file
      });
      stagedItem.status = 'UPLOADED';
    });

    Promise.all(uploadPromises)
      .then(() => {
        // --- 3. THIS IS THE CRITICAL FIX ---
        // We wrap the navigation in `zone.run()` to ensure Angular
        // processes this change and updates the view.
        this.zone.run(() => {
          this.router.navigate(['/projects', projectId]);
        });
      })
      .catch((uploadError) => {
        this.handleError('One or more files failed to upload.', uploadError);
      });
  }

  private handleError(message: string, error: any) {
    console.error(message, error);
    alert(`Error: ${message} Please check the console for details.`);
    this.isCreating = false;
    this.stagedFiles.forEach(item => {
      if (item.status === 'UPLOADING') item.status = 'FAILED';
    });
  }
}