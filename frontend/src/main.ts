import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// This is the first line of your application's code that runs in the browser.
// It tells Angular to start the entire application.
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));