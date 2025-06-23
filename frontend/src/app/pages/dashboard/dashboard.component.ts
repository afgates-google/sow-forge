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
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
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
}
