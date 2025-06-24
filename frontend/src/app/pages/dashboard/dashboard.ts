import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Subscription, timer } from 'rxjs';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  sows: any[] = [];
  isLoading = true;
  statusMessage = '';
  editingDocId: string | null = null;
  editingDocName: string = '';
  private poller!: Subscription;
  constructor(private apiService: ApiService) {}
  ngOnInit(): void { this.loadSows(); this.poller = timer(15000, 15000).subscribe(() => this.loadSows(false)); }
  ngOnDestroy(): void { if (this.poller) { this.poller.unsubscribe(); } }
  loadSows(showLoadingSpinner: boolean = true): void { if (showLoadingSpinner) { this.isLoading = true; } this.apiService.getAllSows().subscribe({ next: (data) => { this.sows = data; if (showLoadingSpinner) this.isLoading = false; }, error: (err) => { this.statusMessage = 'Failed to load document history.'; console.error(err); if (showLoadingSpinner) this.isLoading = false; } }); }
  startEditingName(sow: any): void { this.editingDocId = sow.id; this.editingDocName = sow.display_name || sow.original_filename; }
  cancelEditing(): void { this.editingDocId = null; this.editingDocName = ''; }
  saveName(sowId: string): void { if (!this.editingDocName || !sowId) return; this.apiService.updateDocument(sowId, { display_name: this.editingDocName }).subscribe({ next: () => { this.statusMessage = 'Name updated.'; this.cancelEditing(); this.loadSows(false); setTimeout(() => this.statusMessage = '', 3000); }, error: (err) => { alert(`Failed to save name: ${err.message}`); this.cancelEditing(); } }); }
  /**
 * Checks if a document is in a non-deletable, processing state.
 * @param status The status string from the SOW document.
 * @returns True if the status indicates processing is ongoing.
 */
isProcessing(status: string): boolean {
  if (!status) return false;
  return status.includes('PROCESSING') || status.includes('ANALYZING') || status.includes('REANALYSIS');
}

/**
 * Called when the user clicks the delete button.
 */
deleteSow(sowId: string, sowName: string): void {
  if (confirm(`Are you sure you want to permanently delete "${sowName}" and all of its associated data? This action cannot be undone.`)) {
    // We will need a new method in our ApiService
    this.apiService.deleteSow(sowId).subscribe({
      next: () => {
        this.statusMessage = `Document "${sowName}" deleted successfully.`;
        // Refresh the list to remove the deleted item
        this.loadSows(false); 
        setTimeout(() => this.statusMessage = '', 3000);
      },
      error: (err) => {
        alert(`Error deleting document: ${err.error?.message || err.message}`);
      }
    });
  }
}
}
