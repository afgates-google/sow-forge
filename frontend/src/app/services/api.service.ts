import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Interface for the file metadata sent to create a project
interface FileMetadata {
  filename: string;
  category: string;
  contentType: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private http: HttpClient) { }

  // --- SOW Project Management ---

  createProject(projectName: string, files: FileMetadata[]): Observable<any> {
    return this.http.post('/api/projects', { projectName, files });
  }

  getProjects(): Observable<any[]> {
    return this.http.get<any[]>('/api/projects');
  }

  getProjectDetails(projectId: string): Observable<any> {
    return this.http.get<any>(`/api/projects/${projectId}`);
  }

  updateProject(projectId: string, data: { [key: string]: any }): Observable<any> {
    return this.http.put(`/api/projects/${projectId}`, data);
  }

  deleteProject(projectId: string): Observable<any> {
    return this.http.delete(`/api/projects/${projectId}`);
  }

  generateSow(projectId: string, templateId: string): Observable<string> {
    return this.http.post('/api/generate-sow', { projectId, templateId }, { responseType: 'text' });
  }

  createGoogleDoc(projectId: string): Observable<any> {
    // This endpoint must be updated on the backend to accept a projectId
    return this.http.post('/api/create-google-doc', { projectId });
  }

  // --- Template Management ---

  getTemplates(): Observable<any[]> {
    return this.http.get<any[]>('/api/templates');
  }
  
  getTemplateDetails(templateId: string): Observable<any> {
    return this.http.get<any>(`/api/templates/${templateId}`);
  }

  updateTemplate(templateId: string, markdownContent: string): Observable<any> {
    return this.http.put(`/api/templates/${templateId}`, { markdownContent });
  }

  deleteTemplate(templateId: string): Observable<any> {
    return this.http.delete(`/api/templates/${templateId}`);
  }

  // This method proxies to the template_generation_func
  createTemplateFromSamples(templateName: string, templateDescription: string, sampleFiles: string[]): Observable<any> {
    return this.http.post('/api/generate-template', { 
      template_name: templateName,
      template_description: templateDescription,
      sample_files: sampleFiles 
    });
  }

  // --- Utility for direct GCS uploads ---
  
  getUploadUrl(filename: string, contentType: string, targetBucket: 'sows' | 'templates'): Observable<any> {
    return this.http.post('/api/generate-upload-url', { filename, contentType, targetBucket });
  }


  // --- Settings & Prompt Management ---

  getSettings(): Observable<any> {
    return this.http.get<any>('/api/settings');
  }

  updateSettings(settings: any): Observable<any> {
    return this.http.put('/api/settings', settings);
  }

  getPrompts(): Observable<any[]> {
    return this.http.get<any[]>('/api/prompts');
  }

  getPromptDetails(promptId: string): Observable<any> {
    return this.http.get<any>(`/api/prompts/${promptId}`);
  }

  updatePrompt(promptId: string, promptText: string): Observable<any> {
    return this.http.put(`/api/prompts/${promptId}`, { prompt_text: promptText });
  }
}
