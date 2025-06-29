// In frontend/src/app/app.routes.ts
import { Routes } from '@angular/router';
import { UploadComponent } from './components/upload/upload';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { ProjectStatusComponent } from './pages/project-status/project-status';
import { EditorComponent } from './pages/editor/editor';
import { TemplateManagerComponent } from './pages/template-manager/template-manager';
import { TemplateEditorComponent } from './pages/template-editor/template-editor';
import { PromptManagerComponent } from './pages/prompt-manager/prompt-manager';
import { SettingsComponent } from './pages/settings/settings';
import { AnalysisResultsComponent } from './pages/analysis-results/analysis-results';

export const routes: Routes = [
  { path: '', component: UploadComponent, title: 'SOW-Forge - New Project' },
  { path: 'history', component: DashboardComponent, title: 'SOW-Forge - History' },
  
  // CORRECTED: Standardized on ':projectId'
  { path: 'projects/:projectId', component: ProjectStatusComponent, title: 'SOW-Forge - Project Status' },
  
  { path: 'projects/:projectId/sows/:sowId/editor', component: EditorComponent, title: 'SOW-Forge - Editor' },
  { path: 'projects/:projectId/documents/:docId', component: AnalysisResultsComponent, title: 'SOW-Forge - Analysis Results' },

  { path: 'templates', component: TemplateManagerComponent, title: 'SOW-Forge - Templates' },
  // Note: This :id is for a template, not a project, so it can stay.
  { path: 'templates/:id/edit', component: TemplateEditorComponent, title: 'SOW-Forge - Edit Template' },
  
  { path: 'prompts', component: PromptManagerComponent, title: 'SOW-Forge - Prompts' },
  { path: 'settings', component: SettingsComponent, title: 'SOW-Forge - Settings' },

  // Fallback route
  { path: '**', redirectTo: '', pathMatch: 'full' }
];