import { ErrorHandler, Injectable } from "@angular/core";

/**
 * Receives every uncaught error (template errors, unhandled promise
 * rejections, `window.onerror`...). This is the single place to forward them to
 * a monitoring service such as Sentry.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error("Uncaught error:", error);
  }
}
