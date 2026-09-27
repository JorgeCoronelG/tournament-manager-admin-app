import { HttpClient, HttpContext } from "@angular/common/http";
import { inject, Service } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../http/error.interceptor";
import { SettingsService } from "../settings/settings.service";
import { LoginResponse } from "./login-response.model";

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
}
