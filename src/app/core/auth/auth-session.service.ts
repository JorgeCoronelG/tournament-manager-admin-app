import { inject, Service } from "@angular/core";
import { catchError, map, Observable, of } from "rxjs";
import { CurrentUserService } from "../user/current-user.service";
import { AuthApi } from "./auth.api";
import { AuthTokenService } from "./auth-token.service";
import { toAppUser } from "./authenticated-user.mapper";

/**
 * Verifies whether the stored token still identifies a valid session by
 * calling `/user`. Used by the route guards so the login and dashboard
 * routes agree on what "logged in" means.
 */
@Service()
export class AuthSessionService {
  private readonly authApi = inject(AuthApi);
  private readonly authToken = inject(AuthTokenService);
  private readonly currentUser = inject(CurrentUserService);

  /** Sets the current user as a side effect when the token is valid */
  isAuthenticated(): Observable<boolean> {
    if (!this.authToken.token()) {
      return of(false);
    }

    return this.authApi.me().pipe(
      map((user) => {
        this.currentUser.setUser(toAppUser(user));

        return true;
      }),
      catchError(() => {
        this.authToken.clear();
        this.currentUser.clear();

        return of(false);
      }),
    );
  }
}
