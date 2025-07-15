import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LoggingService {

  log(message: any, ...optionalParams: any[]) {
    if (!environment.production) {
      console.log(message, ...optionalParams);
    }
  }

  warn(message: any, ...optionalParams: any[]) {
    if (!environment.production) {
      console.warn(message, ...optionalParams);
    }
  }

  error(message: any, ...optionalParams: any[]) {
    console.error(message, ...optionalParams);
  }
}
