import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from "@angular/common/http";
import { inject } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TranslocoService } from "@jsverse/transloco";
import { catchError, throwError } from "rxjs";

/**
 * Set to `true` on requests whose callers handle the error themselves and do
 * not want the generic snackbar:
 *
 *   http.get(url, { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) })
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

/** Shows a snackbar for failed requests and lets the error continue */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const snackBar = inject(MatSnackBar);
  const transloco = inject(TranslocoService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        !request.context.get(SKIP_ERROR_NOTIFICATION)
      ) {
        snackBar.open(
          transloco.translate(errorMessageKey(error)),
          transloco.translate("common.ok"),
          { duration: 5000 },
        );
      }

      return throwError(() => error);
    }),
  );
};
