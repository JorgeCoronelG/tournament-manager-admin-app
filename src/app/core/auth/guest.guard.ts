import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { map } from "rxjs";
import { AuthSessionService } from "./auth-session.service";

/** Protects the login route: redirects to the dashboard when there already is a valid session */
export const guestGuard: CanActivateFn = () => {
  const session = inject(AuthSessionService);
  const router = inject(Router);

  return session
    .isAuthenticated()
    .pipe(
      map(
        (authenticated) =>
          !authenticated || router.createUrlTree(["/dashboard"]),
      ),
    );
};
