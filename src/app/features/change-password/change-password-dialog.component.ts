import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { firstValueFrom } from "rxjs";
import {
  form,
  FormField,
  minLength,
  required,
  submit,
  validate,
} from "@angular/forms/signals";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { TranslocoPipe } from "@jsverse/transloco";
import { AuthApi } from "../../core/auth/auth.api";
import { ChangePasswordModel } from "../../core/auth/change-password.model";
import { SnackbarService } from "../../core/snackbar/snackbar.service";

@Component({
  selector: "app-change-password-dialog",
  templateUrl: "./change-password-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
})
export class ChangePasswordDialogComponent {
  private readonly authApi = inject(AuthApi);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialogRef =
    inject<MatDialogRef<ChangePasswordDialogComponent>>(MatDialogRef);

  private readonly model = signal<ChangePasswordModel>({
    currentPassword: "",
    password: "",
    passwordConfirmation: "",
  });

  readonly changePasswordForm = form(this.model, (change) => {
    required(change.currentPassword);
    required(change.password);
    minLength(change.password, 8);
    required(change.passwordConfirmation);
    validate(change.passwordConfirmation, ({ value, valueOf }) =>
      value() === valueOf(change.password) ? undefined : { kind: "mismatch" },
    );
  });

  readonly submitting = signal(false);

  save(): Promise<boolean> {
    return submit(this.changePasswordForm, async () => {
      this.submitting.set(true);

      try {
        const { currentPassword, password, passwordConfirmation } =
          this.model();
        const response = await firstValueFrom(
          this.authApi.changePassword(
            currentPassword,
            password,
            passwordConfirmation,
          ),
        );

        this.snackbar.success(response.message);
        this.dialogRef.close(true);
      } catch {
        // The error interceptor already told the user; keep the dialog open
      } finally {
        this.submitting.set(false);
      }

      return undefined;
    });
  }
}
