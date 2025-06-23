import { Routes } from '@angular/router';
import { UploadComponent } from './components/upload/upload';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { ResultsComponent } from './pages/results/results';
import { EditorComponent } from './pages/editor/editor';
import { TemplateManagerComponent } from './pages/template-manager/template-manager';
import { TemplateEditorComponent } from './pages/template-editor/template-editor';
import { SettingsComponent } from './pages/settings/settings';
import { PromptManagerComponent } from './pages/prompt-manager/prompt-manager';

export const routes: Routes = [
  { path: '', component: UploadComponent },
  { path: 'history', component: DashboardComponent },
  { path: 'results/:id', component: ResultsComponent },
  { path: 'editor/:id', component: EditorComponent },
  { path: 'templates', component: TemplateManagerComponent },
  { path: 'templates/:id/edit', component: TemplateEditorComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'prompts', component: PromptManagerComponent },
  { path: '**', redirectTo: '', pathMatch: 'full' }
];
