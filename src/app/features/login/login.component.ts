import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { Router, RouterLink } from "@angular/router";
import {
  email,
  form,
  FormField,
  required,
  submit,
} from "@angular/forms/signals";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatTooltipModule } from "@angular/material/tooltip";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { backendMessage } from "../../core/http/api-errors";
import { AuthApi } from "../../core/auth/auth.api";
import { AuthTokenService } from "../../core/auth/auth-token.service";
import { toAppUser } from "../../core/auth/authenticated-user.mapper";
import { LoginModel } from "../../core/auth/login.model";
import {
  readRememberedEmail,
  writeRememberedEmail,
} from "../../core/auth/remembered-email.storage";
import { CurrentUserService } from "../../core/user/current-user.service";

@Component({
  selector: "app-login",
  templateUrl: "./login.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTooltipModule,
    RouterLink,
    TranslocoPipe,
  ],
})
export class LoginComponent {
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApi);
  private readonly authToken = inject(AuthTokenService);
  private readonly currentUser = inject(CurrentUserService);
  private readonly transloco = inject(TranslocoService);

  private readonly rememberedEmail = readRememberedEmail();

  private readonly model = signal<LoginModel>({
    email: this.rememberedEmail ?? "",
    password: "",
    rememberMe: this.rememberedEmail !== null,
  });

  readonly loginForm = form(this.model, (login) => {
    required(login.email);
    email(login.email);
    required(login.password);
  });

  readonly passwordVisible = signal(false);
  readonly submitting = signal(false);
  /** Why the sign-in failed, shown as an alert in the form */
  readonly failure = signal<string | null>(null);

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  login(): Promise<boolean> {
    return submit(this.loginForm, async () => {
      this.submitting.set(true);
      this.failure.set(null);

      try {
        const { email, password, rememberMe } = this.model();
        const response = await firstValueFrom(
          this.authApi.login(email, password),
        );

        writeRememberedEmail(rememberMe ? email : null);

        this.authToken.setToken(response.token);
        this.currentUser.setUser(toAppUser(response.user));

        await this.router.navigateByUrl("/dashboard");
      } catch (error) {
        this.failure.set(this.failureMessage(error));
      } finally {
        this.submitting.set(false);
      }

      return undefined;
    });
  }

  /**
   * 401 is wrong credentials. Any other answer with a message from the server
   * (e.g. a 403: access not allowed, or a disabled account) is shown as it comes,
   * never guessed from the status.
   */
  private failureMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        return this.transloco.translate("login.invalidCredentials");
      }

      const message = backendMessage(error);

      if (message) {
        return message;
      }
    }

    return this.transloco.translate("login.error");
  }
}
