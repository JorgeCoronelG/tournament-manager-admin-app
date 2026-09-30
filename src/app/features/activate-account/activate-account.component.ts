import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from "@angular/core";
import { firstValueFrom } from "rxjs";
import { Router, RouterLink } from "@angular/router";
import {
  form,
  FormField,
  minLength,
  required,
  submit,
  validate,
} from "@angular/forms/signals";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { ActivateAccountModel } from "../../core/auth/activate-account.model";
import { AuthApi } from "../../core/auth/auth.api";
import { SnackbarService } from "../../core/snackbar/snackbar.service";
import { failureMessage } from "../../core/http/api-errors";

const CODE_PATTERN = /^\d{6}$/;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

function orEmpty(value: string | undefined): string {
  return value ?? "";
}

/** Public page the invitation e-mail links to: `/activar-cuenta?email=...&code=...` */
@Component({
  selector: "app-activate-account",
  templateUrl: "./activate-account.component.html",
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
export class ActivateAccountComponent {
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApi);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  // Query params (bound by withComponentInputBinding, which passes undefined when one is missing)
  readonly email = input("", { transform: orEmpty });
  readonly code = input("", { transform: orEmpty });

  readonly submitting = signal(false);
  /** The code was rejected (invalid or expired) */
  readonly rejected = signal<string | null>(null);

  /** Without email and code in the URL the user types them (the e-mail offers the code as a fallback) */
  readonly manualEntry = computed(() => !this.email() || !this.code());

  private readonly model = linkedSignal<ActivateAccountModel>(() => ({
    email: this.email(),
    code: this.code(),
    password: "",
    passwordConfirmation: "",
  }));
  readonly activateForm = form(this.model, (activate) => {
    // Only checked when the user types them: a link's own values are the backend's to judge
    required(activate.email, { when: () => this.manualEntry() });
    validate(activate.email, ({ value }) =>
      !this.manualEntry() || !value() || EMAIL_PATTERN.test(value())
        ? undefined
        : { kind: "email" },
    );
    required(activate.code, { when: () => this.manualEntry() });
    validate(activate.code, ({ value }) =>
      !this.manualEntry() || !value() || CODE_PATTERN.test(value())
        ? undefined
        : { kind: "pattern" },
    );
    required(activate.password);
    minLength(activate.password, 8);
    required(activate.passwordConfirmation);
    validate(activate.passwordConfirmation, ({ value, valueOf }) =>
      value() === valueOf(activate.password) ? undefined : { kind: "mismatch" },
    );
  });

  activate(): Promise<boolean> {
    return submit(this.activateForm, async () => {
      this.submitting.set(true);
      this.rejected.set(null);

      try {
        const { email, code, password, passwordConfirmation } = this.model();
        const response = await firstValueFrom(
          this.authApi.activateAccount(
            email.trim(),
            code.trim(),
            password,
            passwordConfirmation,
          ),
        );

        this.snackbar.success(
          response.message || this.transloco.translate("activateAccount.done"),
        );
        await this.router.navigateByUrl("/");
      } catch (error) {
        this.rejected.set(
          failureMessage(error, (key) => this.transloco.translate(key)),
        );
      } finally {
        this.submitting.set(false);
      }

      return undefined;
    });
  }
}
