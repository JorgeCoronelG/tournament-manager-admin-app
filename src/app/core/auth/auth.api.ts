import { HttpClient, HttpContext } from "@angular/common/http";
import { inject, Service } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../http/error.interceptor";
import { KEEP_SESSION_ON_401 } from "../http/session-expired.interceptor";
import { SettingsService } from "../settings/settings.service";
import { AuthenticatedUser, LoginResponse } from "./login-response.model";
import { LoginRequest } from "./login.model";

@Service()
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  /**
   * Identifies this app as the web panel (the only place `client` is set).
   * Errors are handled by the caller (invalid credentials, access not allowed,
   * validation), not the generic snackbar.
   */
  login(email: string, password: string) {
    const body: LoginRequest = { email, password, client: "web" };

    return this.http.post<LoginResponse>(
      this.settings.authApi("/login"),
      body,
      {
        context: new HttpContext()
          .set(SKIP_ERROR_NOTIFICATION, true)
          .set(KEEP_SESSION_ON_401, true),
      },
    );
  }

  logout() {
    return this.http.post<void>(
      this.settings.authApi("/logout"),
      {},
      { context: new HttpContext().set(KEEP_SESSION_ON_401, true) },
    );
  }

  /** Used by the guards to check whether the stored token is still valid (they end the session themselves) */
  me() {
    return this.http.get<AuthenticatedUser>(this.settings.authApi("/user"), {
      context: new HttpContext()
        .set(SKIP_ERROR_NOTIFICATION, true)
        .set(KEEP_SESSION_ON_401, true),
    });
  }

  /**
   * Always resolves with a generic message: it never reveals whether the email
   * exists. The caller shows the errors (e.g. too many attempts).
   */
  forgotPassword(email: string) {
    return this.http.post<{ message: string }>(
      this.settings.authApi("/forgot-password"),
      { email },
      { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) },
    );
  }

  resetPassword(
    email: string,
    code: string,
    password: string,
    passwordConfirmation: string,
  ) {
    return this.http.post<{ message: string }>(
      this.settings.authApi("/reset-password"),
      {
        email,
        code,
        password,
        password_confirmation: passwordConfirmation,
      },
      { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) },
    );
  }

  /**
   * Public: sets the password of an invited user with the code from the e-mail.
   * The caller shows the error (invalid or expired code) inline.
   */
  activateAccount(
    email: string,
    code: string,
    password: string,
    passwordConfirmation: string,
  ) {
    return this.http.post<{ message: string }>(
      this.settings.authApi("/activate-account"),
      {
        email,
        code,
        password,
        password_confirmation: passwordConfirmation,
      },
      { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) },
    );
  }

  changePassword(
    currentPassword: string,
    password: string,
    passwordConfirmation: string,
  ) {
    return this.http.put<{ message: string }>(
      this.settings.authApi("/user/password"),
      {
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      },
      // Their 401 means "wrong current password", not an ended session
      { context: new HttpContext().set(KEEP_SESSION_ON_401, true) },
    );
  }
}
