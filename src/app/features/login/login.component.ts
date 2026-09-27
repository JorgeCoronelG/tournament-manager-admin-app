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
import { TranslocoPipe } from "@jsverse/transloco";
import { AuthApi } from "../../core/auth/auth.api";
import { AuthTokenService } from "../../core/auth/auth-token.service";
import { LoginModel } from "../../core/auth/login.model";
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

  private readonly model = signal<LoginModel>({
    email: "",
    password: "",
    rememberMe: false,
  });

  readonly loginForm = form(this.model, (login) => {
    required(login.email);
    email(login.email);
    required(login.password);
  });

  readonly passwordVisible = signal(false);
  readonly submitting = signal(false);
  readonly errorKey = signal<string | null>(null);

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  login(): Promise<boolean> {
    return submit(this.loginForm, async () => {
      this.submitting.set(true);
      this.errorKey.set(null);

      try {
        const { email, password } = this.model();
        const response = await firstValueFrom(
          this.authApi.login(email, password),
        );

        this.authToken.setToken(response.token);
        this.currentUser.setUser({
          name: response.user.name,
          role: "",
          avatarUrl: "assets/img/avatars/default.jpg",
        });

        await this.router.navigateByUrl("/dashboard");
      } catch (error) {
        this.errorKey.set(
          error instanceof HttpErrorResponse && error.status === 401
            ? "login.invalidCredentials"
            : "login.error",
        );
      } finally {
        this.submitting.set(false);
      }

      return undefined;
    });
  }
}
