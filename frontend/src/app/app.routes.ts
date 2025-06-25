import { Routes } from '@angular/router';
import { UploadComponent } from './components/upload/upload';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { ProjectStatusComponent } from './pages/project-status/project-status';
import { EditorComponent } from './pages/editor/editor';
import { TemplateManagerComponent } from './pages/template-manager/template-manager';
import { TemplateEditorComponent } from './pages/template-editor/template-editor';
import { PromptManagerComponent } from './pages/prompt-manager/prompt-manager';
import { SettingsComponent } from './pages/settings/settings';

// --- Simplified routes to only include the refactored project workflow ---
export const routes: Routes = [
  { path: '', component: UploadComponent, title: 'SOW-Forge - New Project' },
  { path: 'history', component: DashboardComponent, title: 'SOW-Forge - History' },
  { path: 'projects/:id', component: ProjectStatusComponent, title: 'SOW-Forge - Project Status' },
  { path: 'projects/:id/editor', component: EditorComponent, title: 'SOW-Forge - Editor' },
  { path: 'templates', component: TemplateManagerComponent, title: 'SOW-Forge - Templates' },
  { path: 'templates/:id/edit', component: TemplateEditorComponent, title: 'SOW-Forge - Edit Template' },
  { path: 'prompts', component: PromptManagerComponent, title: 'SOW-Forge - Prompts' },
  { path: 'settings', component: SettingsComponent, title: 'SOW-Forge - Settings' },

  // Add a fallback route
  { path: '**', redirectTo: '', pathMatch: 'full' }
];