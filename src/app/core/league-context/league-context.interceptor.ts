import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, throwError } from "rxjs";
import { LeagueContextService } from "./league-context.service";

/**
 * A 403 or 404 from an endpoint nested in the active league means the user lost
 * access to it (or it was deleted): load the leagues again so the active one is
 * chosen with the usual rule.
 */
export const leagueContextInterceptor: HttpInterceptorFn = (request, next) => {
  const leagueContext = inject(LeagueContextService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        (error.status === 403 || error.status === 404) &&
        leagueContext.isActiveLeagueUrl(request.url)
      ) {
        leagueContext.reload();
      }

      return throwError(() => error);
    }),
  );
};
