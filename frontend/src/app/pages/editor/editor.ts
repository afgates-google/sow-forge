import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common'; // <-- IMPORT
import { FormsModule } from '@angular/forms'; // <-- IMPORT

@Component({
  selector: 'app-editor',
  standalone: true, // <-- SET
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './editor.html',
  styleUrls: ['./editor.css']
})
export class EditorComponent implements OnInit {
  // --- Component State ---
  project: any = null;
  projectId!: string;
  
  editableSowText: string = 'Loading SOW content...';
  originalSowText: string = ''; // Used to track changes

  isSaving = false;
  isCreatingGDoc = false;
  statusMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService // Assumes ApiService is updated
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      // Handle error case where ID is missing
      this.statusMessage = "Error: Project ID not found in URL.";
      this.router.navigate(['/history']); // Redirect to history/dashboard
      return;
    }
    this.projectId = id;
    this.loadSowContent();
  }

  /**
   * Fetches the project details and populates the editor.
   */
  loadSowContent(): void {
    this.apiService.getProjectDetails(this.projectId).subscribe({
      next: (data: any) => {
        this.project = data;
        this.editableSowText = data.generatedSowText || '# Statement of Work\n\n*No content has been generated for this project yet.*';
        this.originalSowText = this.editableSowText;
      },
      error: (err: any) => {
        this.statusMessage = `Error: Could not load project ${this.projectId}.`;
        console.error(err);
      }
    });
  }

  /**
   * A getter to easily check if the SOW text has been modified.
   * @returns {boolean} True if changes have been made.
   */
  get isDirty(): boolean {
    return this.editableSowText !== this.originalSowText;
  }

  /**
   * Saves the modified SOW text back to the project document in Firestore.
   */
  saveSow(): void {
    if (!this.isDirty || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.statusMessage = "Saving...";

    // Assume ApiService has an `updateProject` method
    this.apiService.updateProject(this.projectId, { generatedSowText: this.editableSowText }).subscribe({
      next: () => {
        this.originalSowText = this.editableSowText; // Update the original text to the new saved version
        this.statusMessage = `Saved successfully at ${new Date().toLocaleTimeString()}`;
        setTimeout(() => this.statusMessage = '', 3000); // Clear message after 3 seconds
      },
      error: (err: any) => {
        this.statusMessage = "Save failed. Please try again.";
        console.error("Failed to save SOW:", err);
      },
      complete: () => {
        this.isSaving = false;
      }
    });
  }

  /**
   * Triggers the backend function to create a Google Doc from the SOW text.
   */
  createGoogleDoc(): void {
    if (this.isCreatingGDoc) {
      return;
    }

    this.isCreatingGDoc = true;
    this.statusMessage = "Creating Google Doc...";

    // Assume ApiService has a `createGoogleDoc` method that now takes a projectId
    this.apiService.createGoogleDoc(this.projectId).subscribe({
      next: (response) => {
        this.statusMessage = "Google Doc created successfully!";
        // Update the local project object with the new URL to display it immediately
        if (this.project) {
          this.project.google_doc_url = response.doc_url;
        }
        window.open(response.doc_url, '_blank'); // Open the new doc in a new tab
        setTimeout(() => this.statusMessage = '', 3000);
      },
      error: (err) => {
        this.statusMessage = "Failed to create Google Doc.";
        console.error("Failed to create Google Doc:", err);
      },
      complete: () => {
        this.isCreatingGDoc = false;
      }
    });
  }
}