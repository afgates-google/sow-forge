import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

  // --- Source Document Management ---

  getSourceDocumentDetails(projectId: string, docId: string): Observable<any> {
    return this.http.get<any>(`/api/projects/${projectId}/documents/${docId}`);
  }

  regenerateAnalysis(projectId: string, docId: string): Observable<any> {
    return this.http.post(`/api/projects/${projectId}/source_documents/${docId}/regenerate`, {});
  }

  updateSourceDocument(projectId: string, docId: string, data: { displayName?: string, category?: string }): Observable<any> {
    return this.http.put(`/api/projects/${projectId}/source_documents/${docId}`, data);
  }

  // --- Generated SOW Management ---

  generateSow(projectId: string, templateId: string): Observable<any> {
    return this.http.post('/api/generate-sow', { projectId, templateId });
  }

  getGeneratedSowDetails(projectId: string, sowId: string): Observable<any> {
    return this.http.get<any>(`/api/projects/${projectId}/sows/${sowId}`);
  }

  // THIS IS THE CORRECTED METHOD
  updateGeneratedSow(projectId: string, sowId: string, data: { templateName: string }): Observable<any> {
    return this.http.put(`/api/projects/${projectId}/sows/${sowId}`, data);
  }
  
  deleteGeneratedSow(projectId: string, sowId: string): Observable<any> {
    return this.http.delete(`/api/projects/${projectId}/sows/${sowId}`);
  }

  createGoogleDocForSow(projectId: string, sowId: string): Observable<any> {
    return this.http.post('/api/create-google-doc', { projectId, sowId });
  }

  // --- Template & Prompt Management ---

  getTemplates(): Observable<any[]> {
    return this.http.get<any[]>('/api/templates');
  }
  
  getTemplateDetails(templateId: string): Observable<any> {
    return this.http.get<any>(`/api/templates/${templateId}`);
  }

  updateTemplate(templateId: string, data: { name?: string; markdownContent?: string }): Observable<any> {
    return this.http.put(`/api/templates/${templateId}`, data);
  }

  deleteTemplate(templateId: string): Observable<any> {
    return this.http.delete(`/api/templates/${templateId}`);
  }

  createTemplateFromSamples(templateName: string, templateDescription: string, sampleFilePaths: string[]): Observable<any> {
    return this.http.post('/api/generate-template', { 
      template_name: templateName,
      template_description: templateDescription,
      sample_files: sampleFilePaths 
    });
  }

  getPrompts(): Observable<any[]> {
    return this.http.get<any[]>('/api/prompts');
  }

  getPromptDetails(promptId: string): Observable<any> {
    return this.http.get<any>(`/api/prompts/${promptId}`);
  }

  updatePrompt(promptId: string, data: { name?: string; prompt_text?: string }): Observable<any> {
    return this.http.put(`/api/prompts/${promptId}`, data);
  }

  // --- Settings & Utilities ---

  getSettings(): Observable<any> {
    return this.http.get<any>('/api/settings');
  }

  updateSettings(settings: any): Observable<any> {
    return this.http.put('/api/settings', settings);
  }

  getUploadUrl(filename: string, contentType: string, targetBucket: 'sows' | 'templates'): Observable<any> {
    return this.http.post('/api/generate-upload-url', { filename, contentType, targetBucket });
  }
}