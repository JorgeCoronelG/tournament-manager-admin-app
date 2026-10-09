import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from "@angular/common/http";
import { inject } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { AuthSessionService } from "../auth/auth-session.service";
import { AuthTokenService } from "../auth/auth-token.service";

/**
 * Set to `true` on requests where a 401 is part of their normal answer and does
 * not mean the session is gone (wrong credentials, wrong current password):
 *
 *   { context: new HttpContext().set(KEEP_SESSION_ON_401, true) }
 */
export const KEEP_SESSION_ON_401 = new HttpContextToken<boolean>(() => false);

/**
 * A 401 on a request that carried the session's token means the session ended
 * on the server (the token expired or was revoked, or the account was
 * disabled): clear everything stored for it and send the user to the login.
 * The error still reaches the caller, and the error interceptor still tells
 * the user.
 */
export const sessionExpiredInterceptor: HttpInterceptorFn = (request, next) => {
  const authToken = inject(AuthTokenService);
  const session = inject(AuthSessionService);
  const router = inject(Router);
  const dialog = inject(MatDialog);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !request.context.get(KEEP_SESSION_ON_401) &&
        // Several requests can fail at once: only the first one finds a session to end
        authToken.token()
      ) {
        session.end();
        dialog.closeAll();
        void router.navigateByUrl("/");
      }

      return throwError(() => error);
    }),
  );
};
