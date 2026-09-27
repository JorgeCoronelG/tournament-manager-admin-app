import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { firstValueFrom } from "rxjs";
import { Router, RouterLink } from "@angular/router";
import {
  email,
  form,
  FormField,
  minLength,
  pattern,
  required,
  submit,
  validate,
} from "@angular/forms/signals";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { TranslocoPipe } from "@jsverse/transloco";
import { AuthApi } from "../../core/auth/auth.api";
import { ForgotPasswordModel } from "../../core/auth/forgot-password.model";
import { ResetPasswordModel } from "../../core/auth/reset-password.model";
import { SnackbarService } from "../../core/snackbar/snackbar.service";

const CODE_PATTERN = /^\d{6}$/;

@Component({
  selector: "app-forgot-password",
  templateUrl: "./forgot-password.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    RouterLink,
    TranslocoPipe,
  ],
})
export class ForgotPasswordComponent {
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApi);
  private readonly snackbar = inject(SnackbarService);

  readonly step = signal<"request" | "reset">("request");
  readonly submitting = signal(false);
  readonly sentTo = signal("");

  private readonly requestModel = signal<ForgotPasswordModel>({ email: "" });
  readonly requestForm = form(this.requestModel, (login) => {
    required(login.email);
    email(login.email);
  });

  private readonly resetModel = signal<ResetPasswordModel>({
    code: "",
    password: "",
    passwordConfirmation: "",
  });
  readonly resetForm = form(this.resetModel, (reset) => {
    required(reset.code);
    pattern(reset.code, CODE_PATTERN);
    required(reset.password);
    minLength(reset.password, 8);
    required(reset.passwordConfirmation);
    validate(reset.passwordConfirmation, ({ value, valueOf }) =>
      value() === valueOf(reset.password) ? undefined : { kind: "mismatch" },
    );
  });

  requestCode(): Promise<boolean> {
    return submit(this.requestForm, async () => {
      this.submitting.set(true);

      try {
        const { email } = this.requestModel();
        const response = await firstValueFrom(
          this.authApi.forgotPassword(email),
        );

        this.sentTo.set(email);
        this.step.set("reset");
        this.snackbar.info(response.message);
      } catch {
        // The error interceptor already told the user
      } finally {
        this.submitting.set(false);
      }

      return undefined;
    });
  }

  requestAnotherCode(): void {
    this.resetModel.set({
      code: "",
      password: "",
      passwordConfirmation: "",
    });
    this.step.set("request");
  }

  resetPassword(): Promise<boolean> {
    return submit(this.resetForm, async () => {
      this.submitting.set(true);

      try {
        const { code, password, passwordConfirmation } = this.resetModel();
        const response = await firstValueFrom(
          this.authApi.resetPassword(
            this.sentTo(),
            code,
            password,
            passwordConfirmation,
          ),
        );

        this.snackbar.success(response.message);
        await this.router.navigateByUrl("/");
      } catch {
        // The error interceptor already told the user
      } finally {
        this.submitting.set(false);
      }

      return undefined;
    });
  }
}
