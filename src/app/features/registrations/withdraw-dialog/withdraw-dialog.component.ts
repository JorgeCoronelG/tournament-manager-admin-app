import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import {
  form,
  FormField,
  maxLength,
  required,
  validate,
  ValidationError,
} from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import {
  REASON_MAX,
  REASON_MIN,
  Registration,
  WithdrawResult,
} from "../registration.model";
import { RegistrationsApi } from "../registrations.api";

export interface WithdrawDialogData {
  tournamentId: number;
  registration: Registration;
}

/**
 * Withdraws a team from a tournament in progress: shows what will happen to its
 * pending matches and players, and asks why. Closes with the result once the
 * backend accepted it; a refusal stays in the dialog.
 */
@Component({
  selector: "app-withdraw-dialog",
  templateUrl: "./withdraw-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    TranslocoPipe,
  ],
})
export class WithdrawDialogComponent {
  private readonly api = inject(RegistrationsApi);
  private readonly dialogRef =
    inject<MatDialogRef<WithdrawDialogComponent, WithdrawResult>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly data = inject<WithdrawDialogData>(MAT_DIALOG_DATA);
  readonly team = this.data.registration.team;

  protected readonly preview = this.api.withdrawPreview(
    this.data.tournamentId,
    this.data.registration.id,
  );
  readonly summary = computed(() =>
    this.preview.hasValue() ? this.preview.value() : undefined,
  );

  private readonly model = signal({ reason: "" });

  /** A refusal that belongs to no field */
  readonly serverError = signal<string | null>(null);

  readonly withdrawForm = form(this.model, (value) => {
    required(value.reason);
    validate(value.reason, ({ value: reason }) =>
      reason().trim().length > 0 && reason().trim().length < REASON_MIN
        ? { kind: "minLength" }
        : undefined,
    );
    maxLength(value.reason, REASON_MAX);
  });

  /** Save waits for the summary and for a valid reason */
  readonly canSave = computed(
    () => this.summary() !== undefined && this.withdrawForm().valid(),
  );

  /** Server messages win over the generic text of the failed rule */
  errorText(errors: readonly ValidationError[]): string {
    const message = errors.find((error) => error.message)?.message;

    if (message) {
      return message;
    }

    switch (errors[0]?.kind) {
      case "minLength":
        return this.transloco.translate("validation.minLength", {
          min: REASON_MIN,
        });
      case "maxLength":
        return this.transloco.translate("validation.maxLength", {
          max: REASON_MAX,
        });
      default:
        return this.transloco.translate("validation.required");
    }
  }

  save(): Promise<boolean> {
    this.serverError.set(null);

    return this.formSubmit.submit(this.withdrawForm, {
      errors: "form",
      onFormError: (message) => this.serverError.set(message),
      send: () =>
        this.api.withdraw(
          this.data.tournamentId,
          this.data.registration.id,
          this.model().reason,
        ),
      onSuccess: (result) => this.dialogRef.close(result),
    });
  }
}
