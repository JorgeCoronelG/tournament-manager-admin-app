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
import { BanResult, fullName, Player } from "../player.model";
import { PlayersApi } from "../players.api";

const REASON_MIN = 5;
const REASON_MAX = 255;

/**
 * Asks why a player is banned from the league. Closes with the result of the
 * ban once the backend accepted it; a refusal stays in the dialog.
 */
@Component({
  selector: "app-player-ban-dialog",
  templateUrl: "./player-ban-dialog.component.html",
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
export class PlayerBanDialogComponent {
  private readonly api = inject(PlayersApi);
  private readonly dialogRef =
    inject<MatDialogRef<PlayerBanDialogComponent, BanResult>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly player = inject<Player>(MAT_DIALOG_DATA);
  readonly name = fullName(this.player);

  private readonly model = signal({ reason: "" });

  /** A refusal that belongs to no field */
  readonly serverError = signal<string | null>(null);

  readonly banForm = form(this.model, (value) => {
    required(value.reason);
    validate(value.reason, ({ value: reason }) =>
      reason().trim().length > 0 && reason().trim().length < REASON_MIN
        ? { kind: "minLength" }
        : undefined,
    );
    maxLength(value.reason, REASON_MAX);
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

    return this.formSubmit.submit(this.banForm, {
      errors: "form",
      onFormError: (message) => this.serverError.set(message),
      send: () => this.api.ban(this.player.id, this.model().reason),
      onSuccess: (result) => this.dialogRef.close(result),
    });
  }
}
