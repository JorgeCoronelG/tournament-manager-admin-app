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
import { MatRadioModule } from "@angular/material/radio";
import { form, FormField, maxLength } from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { MatchesApi } from "../matches.api";

/** A team of the match, as the dialog offers it */
export interface WalkoverTeam {
  registration_id: number;
  name: string;
}

export interface WalkoverDialogData {
  tournamentId: number;
  matchId: number;
  home: WalkoverTeam;
  away: WalkoverTeam;
  /** Goals the winner gets */
  goals: number;
  /** A playoff match decides the whole tie */
  playoff: boolean;
  /** The team that is withdrawn, already picked as the one that did not show up */
  loserRegistrationId?: number;
}

const REASON_MAX = 255;

/**
 * Registers a default win: the team that did not show up loses and the rival
 * wins by the tournament's default score. Closes with `true` once saved.
 */
@Component({
  selector: "app-walkover-dialog",
  templateUrl: "./walkover-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    TranslocoPipe,
  ],
})
export class WalkoverDialogComponent {
  private readonly api = inject(MatchesApi);
  private readonly dialogRef =
    inject<MatDialogRef<WalkoverDialogComponent, boolean>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly data = inject<WalkoverDialogData>(MAT_DIALOG_DATA);
  readonly teams = [this.data.home, this.data.away];

  /** The team that did not show up */
  readonly loser = signal<WalkoverTeam | null>(
    this.teams.find(
      (team) => team.registration_id === this.data.loserRegistrationId,
    ) ?? null,
  );
  readonly winner = computed(() => {
    const loser = this.loser();

    return loser
      ? this.teams.find(
          (team) => team.registration_id !== loser.registration_id,
        )
      : undefined;
  });

  /** The backend's refusal */
  readonly formError = signal<string | null>(null);

  private readonly model = signal({ reason: "" });
  readonly walkoverForm = form(this.model, (value) => {
    maxLength(value.reason, REASON_MAX);
  });

  reasonError(): string {
    return this.transloco.translate("validation.maxLength", {
      max: REASON_MAX,
    });
  }

  save(): Promise<boolean> {
    const loser = this.loser();

    if (!loser) {
      return Promise.resolve(false);
    }

    this.formError.set(null);

    return this.formSubmit.submit(this.walkoverForm, {
      errors: "form",
      onFormError: (message) => this.formError.set(message),
      send: () =>
        this.api.walkover(
          this.data.tournamentId,
          this.data.matchId,
          loser.registration_id,
          this.model().reason,
        ),
      onSuccess: () => this.dialogRef.close(true),
    });
  }
}
