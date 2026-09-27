import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from "@angular/common/http";
import { inject } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslocoService } from "@jsverse/transloco";
import { catchError, throwError } from "rxjs";
import { SnackbarService } from "../snackbar/snackbar.service";
import { ValidationErrorsDialogComponent } from "./validation-errors-dialog/validation-errors-dialog.component";

/**
 * Set to `true` on requests whose callers handle the error themselves and do
 * not want the generic snackbar:
 *
 *   http.getPerf(url, { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) })
 */
export const SKIP_ERROR_NOTIFICATION = new HttpContextToken<boolean>(
  () => false,
);

export function errorMessageKey(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return "errors.network";
  }

  if (error.status === 401 || error.status === 403) {
    return "errors.forbidden";
  }

  if (error.status === 404) {
    return "errors.notFound";
  }

  return error.status >= 500 ? "errors.server" : "errors.generic";
}

/**
 * Laravel's 422 responses put `{ [field]: string[] }` in `error.error`. Returns
 * the flattened list of messages, or `null` when the error isn't shaped like that.
 */
export function validationErrors(error: HttpErrorResponse): string[] | null {
  if (error.status !== 422) {
    return null;
  }

  const body: unknown = error.error;
  const fieldErrors =
    body && typeof body === "object"
      ? (body as { error?: unknown }).error
      : null;

  if (
    !fieldErrors ||
    typeof fieldErrors !== "object" ||
    Array.isArray(fieldErrors)
  ) {
    return null;
  }

  const messages = Object.values(fieldErrors as Record<string, unknown>)
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .filter((value): value is string => typeof value === "string");

  return messages.length ? messages : null;
}

/** The plain-text `error` the backend sends on business errors (e.g. "Código inválido o expirado.") */
export function backendMessage(error: HttpErrorResponse): string | null {
  const body: unknown = error.error;
  const message =
    body && typeof body === "object"
      ? (body as { error?: unknown }).error
      : null;

  return typeof message === "string" && message ? message : null;
}

/**
 * Shows the backend's validation errors in a dialog, or its business message
 * (falling back to a generic one for the status) in a snackbar
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const snackbar = inject(SnackbarService);
  const dialog = inject(MatDialog);
  const transloco = inject(TranslocoService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        !request.context.get(SKIP_ERROR_NOTIFICATION)
      ) {
        const messages = validationErrors(error);

        if (messages) {
          dialog.open(ValidationErrorsDialogComponent, { data: messages });
        } else {
          snackbar.error(
            backendMessage(error) ??
            transloco.translate(errorMessageKey(error)),
            transloco.translate("common.ok"),
          );
        }
      }

      return throwError(() => error);
    }),
  );
};
