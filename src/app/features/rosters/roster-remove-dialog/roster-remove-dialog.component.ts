import {
  ChangeDetectionStrategy,
  Component,
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
import { RostersApi } from "../rosters.api";

export interface RosterRemoveDialogData {
  tournamentId: number;
  registrationId: number;
  rosterId: number;
  player: string;
  team: string;
}

const REASON_MIN = 5;
const REASON_MAX = 255;

/**
 * Asks why an active player is removed from the roster. Closes with `true`
 * once the backend accepted it; a refusal stays in the dialog.
 */
@Component({
  selector: "app-roster-remove-dialog",
  templateUrl: "./roster-remove-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
})
export class RosterRemoveDialogComponent {
  private readonly api = inject(RostersApi);
  private readonly dialogRef =
    inject<MatDialogRef<RosterRemoveDialogComponent, boolean>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly data = inject<RosterRemoveDialogData>(MAT_DIALOG_DATA);

  readonly reasonMax = REASON_MAX;

  private readonly model = signal({ removal_reason: "" });

  /** A refusal that belongs to no field (liguilla started, tournament finished...) */
  readonly serverError = signal<string | null>(null);

  readonly removeForm = form(this.model, (value) => {
    required(value.removal_reason);
    validate(value.removal_reason, ({ value: reason }) =>
      reason().trim().length > 0 && reason().trim().length < REASON_MIN
        ? { kind: "minLength" }
        : undefined,
    );
    maxLength(value.removal_reason, REASON_MAX);
  });

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

    return this.formSubmit.submit(this.removeForm, {
      errors: "form",
      onFormError: (message) => this.serverError.set(message),
      send: () =>
        this.api.remove(
          this.data.tournamentId,
          this.data.registrationId,
          this.data.rosterId,
          this.model().removal_reason,
        ),
      onSuccess: () => this.dialogRef.close(true),
    });
  }
}
