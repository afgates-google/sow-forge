import { Routes } from '@angular/router';
import { UploadComponent } from './components/upload/upload.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ResultsComponent } from './pages/results/results.component';
import { EditorComponent } from './pages/editor/editor.component';
import { TemplateManagerComponent } from './pages/template-manager/template-manager.component';
import { TemplateEditorComponent } from './pages/template-editor/template-editor.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { PromptManagerComponent } from './pages/prompt-manager/prompt-manager.component';

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
