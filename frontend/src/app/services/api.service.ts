import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) { }

  getUploadUrl(filename: string, contentType: string, targetBucket: 'sows' | 'templates' = 'sows'): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.apiUrl}/generate-upload-url`, { filename, contentType, targetBucket });
  }
  uploadFile(url: string, file: File): Observable<HttpEvent<any>> {
    const req = new HttpRequest('PUT', url, file, { reportProgress: true });
    return this.http.request(req);
  }
  getAllSows(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/sows`);
  }
  getAnalysisResults(docId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/results/${docId}`);
  }
  updateDocument(docId: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/sows/${docId}`, data);
  }
  regenerateAnalysis(docId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/regenerate/${docId}`, {});
  }
  generateSow(docId: string, templateId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/generate-sow`, { docId, templateId }, { responseType: 'text' });
  }
  getTemplates(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/templates`);
  }
  getTemplateContent(templateId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/templates/${templateId}`);
  }
  updateTemplate(templateId: string, markdownContent: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/templates/${templateId}`, { markdownContent });
  }
  deleteTemplate(templateId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/templates/${templateId}`);
  }
  createTemplateFromSamples(name: string, desc: string, paths: string[]): Observable<any> {
    const payload = { template_name: name, template_description: desc, sample_files: paths };
    return this.http.post(`${this.apiUrl}/generate-template`, payload);
  }
  getSettings(): Observable<any> {
    return this.http.get(`${this.apiUrl}/settings`);
  }
  updateSettings(settings: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/settings`, settings);
  }
  getPrompts(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/prompts`);
  }
  getPrompt(promptId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/prompts/${promptId}`);
  }
  updatePrompt(promptId: string, newPromptText: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/prompts/${promptId}`, { prompt_text: newPromptText });
  }
  /**
 * Asks the backend to create a new Google Doc from the SOW text.
 * @param docId The ID of the SOW document in Firestore.
 * @returns An Observable containing the URL of the newly created Google Doc.
 */
  createGoogleDoc(docId: string): Observable<{ doc_url: string }> {
    return this.http.post<{ doc_url: string }>(`${this.apiUrl}/create-google-doc`, { docId });
  }
 
  deleteSow(sowId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/sows/${sowId}`);
  }
}
