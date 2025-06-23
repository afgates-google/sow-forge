import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpEventType, HttpEvent } from '@angular/common/http';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.html',
  styleUrls: ['./upload.css']
})
export class UploadComponent {
  selectedFile: File | null = null;
  uploadProgress = 0;
  statusMessage = '';
  isUploading = false;
  isPolling = false;
  private pollingInterval: any = null;
  constructor(private apiService: ApiService, private router: Router) {}
  onDragOver(event: DragEvent): void { event.preventDefault(); event.stopPropagation(); (event.currentTarget as HTMLElement).classList.add('is-dragging-over'); }
  onDragLeave(event: DragEvent): void { event.preventDefault(); event.stopPropagation(); (event.currentTarget as HTMLElement).classList.remove('is-dragging-over'); }
  onDrop(event: DragEvent): void { event.preventDefault(); event.stopPropagation(); (event.currentTarget as HTMLElement).classList.remove('is-dragging-over'); if (event.dataTransfer?.files?.[0]) { this.handleFile(event.dataTransfer.files[0]); } }
  onFileSelected(event: any): void { if (event.target.files?.[0]) { this.handleFile(event.target.files[0]); } }
  handleFile(file: File): void { if (this.pollingInterval) { clearInterval(this.pollingInterval); } this.isUploading = false; this.isPolling = false; this.uploadProgress = 0; this.statusMessage = ''; if (file && file.type === 'application/pdf') { this.selectedFile = file; } else { this.selectedFile = null; this.statusMessage = 'Invalid file type. Please upload a PDF.'; } }
  removeFile(): void { this.selectedFile = null; this.statusMessage = ''; this.uploadProgress = 0; this.isUploading = false; this.isPolling = false; if (this.pollingInterval) { clearInterval(this.pollingInterval); } }
  uploadFile(): void { if (!this.selectedFile) return; this.isUploading = true; this.statusMessage = 'Requesting secure upload...'; this.uploadProgress = 0; const file = this.selectedFile; this.apiService.getUploadUrl(file.name, file.type).subscribe({ next: (res) => { this.statusMessage = 'Uploading file...'; this.apiService.uploadFile(res.url, file).subscribe({ next: (event: HttpEvent<any>) => { if (event.type === HttpEventType.UploadProgress && event.total) { this.uploadProgress = Math.round(100 * (event.loaded / event.total)); } else if (event.type === HttpEventType.Response && event.status === 200) { this.statusMessage = 'Upload successful. Starting analysis...'; this.isUploading = false; const docId = file.name.substring(0, file.name.lastIndexOf('.')); this.pollForResults(docId); } }, error: (err) => { this.statusMessage = 'Upload failed.'; this.isUploading = false; console.error(err); } }); }, error: (err) => { this.statusMessage = 'Could not get upload URL.'; this.isUploading = false; console.error(err); } }); }
  pollForResults(docId: string): void { this.isPolling = true; let pollCount = 0; const maxPolls = 24; this.pollingInterval = setInterval(() => { pollCount++; if (pollCount > maxPolls) { clearInterval(this.pollingInterval); this.statusMessage = 'Analysis is taking a long time. Check the history page later.'; this.isPolling = false; return; } this.apiService.getAnalysisResults(docId).subscribe({ next: (result) => { if (result && result.status === 'ANALYZED_SUCCESS') { clearInterval(this.pollingInterval); this.isPolling = false; this.router.navigate(['/results', docId]); } else if (result && result.status === 'ANALYSIS_FAILED') { clearInterval(this.pollingInterval); this.isPolling = false; this.statusMessage = 'Analysis failed.'; } else { this.statusMessage = `Analysis in progress... (Status: ${result?.status || 'PROCESSING'})`; } }, error: () => { this.statusMessage = 'Analysis in progress... (Waiting for results)'; } }); }, 5000); }
}
