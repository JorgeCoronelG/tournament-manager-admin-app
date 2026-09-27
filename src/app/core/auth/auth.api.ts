import { HttpClient, HttpContext } from "@angular/common/http";
import { inject, Service } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../http/error.interceptor";
import { SettingsService } from "../settings/settings.service";
import { AuthenticatedUser, LoginResponse } from "./login-response.model";

@Service()
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  /** Errors are handled by the caller (invalid credentials, validation), not the generic snackbar */
  login(email: string, password: string) {
    return this.http.post<LoginResponse>(
      this.settings.authApi("/login"),
      { email, password },
      { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) },
    );
  }

  logout() {
    return this.http.post<void>(this.settings.authApi("/logout"), {});
  }

  /** Used by the guards to check whether the stored token is still valid */
  me() {
    return this.http.get<AuthenticatedUser>(this.settings.authApi("/user"), {
      context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
    });
  }

  /** Always resolves with a generic message: it never reveals whether the email exists */
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
}
