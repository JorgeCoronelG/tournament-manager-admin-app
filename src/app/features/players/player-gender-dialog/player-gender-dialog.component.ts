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
import { MatSelectModule } from "@angular/material/select";
import {
  form,
  FormField,
  required,
  ValidationError,
} from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { Player, PLAYER_GENDERS, PlayerGender } from "../player.model";
import { PlayersApi } from "../players.api";

/**
 * Fixes the gender a player registered with. Closes with `true` once the
 * backend accepted it; a refusal (e.g. the tournaments that block it) stays in
 * the dialog.
 */
@Component({
  selector: "app-player-gender-dialog",
  templateUrl: "./player-gender-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    TranslocoPipe,
  ],
})
export class PlayerGenderDialogComponent {
  private readonly api = inject(PlayersApi);
  private readonly dialogRef =
    inject<MatDialogRef<PlayerGenderDialogComponent, boolean>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly player = inject<Player>(MAT_DIALOG_DATA);

  readonly genders = PLAYER_GENDERS;

  private readonly model = signal<{ gender: PlayerGender }>({
    gender: this.player.gender,
  });

  /** A refusal that belongs to no field, with the tournaments that block it */
  readonly serverError = signal<string | null>(null);

  readonly genderForm = form(this.model, (value) => {
    required(value.gender);
  });

  /** Server messages win over the generic text of the failed rule */
  errorText(errors: readonly ValidationError[]): string {
    return (
      errors.find((error) => error.message)?.message ??
      this.transloco.translate("validation.required")
    );
  }

  save(): Promise<boolean> {
    this.serverError.set(null);

    return this.formSubmit.submit(this.genderForm, {
      errors: "form",
      onFormError: (message) => this.serverError.set(message),
      send: () => this.api.changeGender(this.player.id, this.model().gender),
      onSuccess: () => this.dialogRef.close(true),
    });
  }
}
