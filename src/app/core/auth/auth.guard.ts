import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { map } from "rxjs";
import { AuthSessionService } from "./auth-session.service";

/** Protects the dashboard routes: redirects to the login page when there is no valid session */
export const authGuard: CanActivateFn = () => {
  const session = inject(AuthSessionService);
  const router = inject(Router);

  return session
    .isAuthenticated()
    .pipe(map((authenticated) => authenticated || router.createUrlTree(["/"])));
};
