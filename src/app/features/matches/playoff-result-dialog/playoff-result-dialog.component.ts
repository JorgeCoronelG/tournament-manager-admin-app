import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
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
import { form, FormField, validate } from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { MatchesApi } from "../matches.api";
import {
  BracketMatch,
  BracketTie,
  globalWith,
  needsPenalties,
} from "../playoff.model";

export interface PlayoffResultDialogData {
  tournamentId: number;
  tie: BracketTie;
  match: BracketMatch;
}

const MAX = 99;

const validScore = (value: number | null): boolean =>
  value !== null && Number.isInteger(value) && value >= 0 && value <= MAX;

/**
 * Captures or changes the score of a playoff match. Penalties are asked only
 * when the match (or, in a second leg, the global score) ends level. Closes
 * with `true` once it is saved.
 */
@Component({
  selector: "app-playoff-result-dialog",
  templateUrl: "./playoff-result-dialog.component.html",
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
export class PlayoffResultDialogComponent {
  private readonly api = inject(MatchesApi);
  private readonly dialogRef =
    inject<MatDialogRef<PlayoffResultDialogComponent, boolean>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly data = inject<PlayoffResultDialogData>(MAT_DIALOG_DATA);

  readonly homeName = this.data.match.home_team?.team_name ?? "—";
  readonly awayName = this.data.match.away_team?.team_name ?? "—";

  /** The backend's refusal (first leg missing, next round already played...) */
  readonly formError = signal<string | null>(null);

  private readonly model = signal<{
    home_goals: number | null;
    away_goals: number | null;
    home_penalties: number | null;
    away_penalties: number | null;
  }>({
    home_goals: this.data.match.home_goals,
    away_goals: this.data.match.away_goals,
    home_penalties: this.data.match.home_penalties,
    away_penalties: this.data.match.away_penalties,
  });

  readonly penaltiesAsked = computed(() =>
    needsPenalties(
      this.data.tie,
      this.data.match,
      this.model().home_goals,
      this.model().away_goals,
    ),
  );

  /** The global score of a second leg with the goals typed so far: "Global: 3-3" */
  readonly global = computed(() => {
    const { home_goals, away_goals } = this.model();

    return home_goals === null || away_goals === null
      ? null
      : globalWith(this.data.tie, this.data.match, home_goals, away_goals);
  });

  readonly resultForm = form(this.model, (result) => {
    validate(result.home_goals, ({ value }) =>
      validScore(value()) ? undefined : { kind: "score" },
    );
    validate(result.away_goals, ({ value }) =>
      validScore(value()) ? undefined : { kind: "score" },
    );
    validate(result.home_penalties, ({ value, valueOf }) => {
      if (!this.penaltiesAsked()) {
        return undefined;
      }

      const own = value();
      const other = valueOf(result.away_penalties);

      return !validScore(own)
        ? { kind: "score" }
        : own === other
          ? { kind: "differ" }
          : undefined;
    });
    validate(result.away_penalties, ({ value }) =>
      !this.penaltiesAsked() || validScore(value())
        ? undefined
        : { kind: "score" },
    );
  });

  // Once the score is no longer level the penalties make no sense: hide and empty them
  private readonly clearPenalties = effect(() => {
    if (
      !this.penaltiesAsked() &&
      untracked(
        () =>
          this.model().home_penalties !== null ||
          this.model().away_penalties !== null,
      )
    ) {
      untracked(() =>
        this.model.update((model) => ({
          ...model,
          home_penalties: null,
          away_penalties: null,
        })),
      );
    }
  });

  scoreError(): string {
    return this.transloco.translate("matches.result.scoreError", { max: MAX });
  }

  penaltiesError(): string {
    return this.transloco.translate("matches.playoffResult.penaltiesError", {
      max: MAX,
    });
  }

  save(): Promise<boolean> {
    this.formError.set(null);

    return this.formSubmit.submit(this.resultForm, {
      errors: "form",
      onFormError: (message) => this.formError.set(message),
      send: () => {
        const { home_goals, away_goals, home_penalties, away_penalties } =
          this.model();

        return this.api.setResult(
          this.data.tournamentId,
          this.data.match.id,
          home_goals as number,
          away_goals as number,
          this.penaltiesAsked()
            ? { home: home_penalties as number, away: away_penalties as number }
            : undefined,
        );
      },
      onSuccess: () => this.dialogRef.close(true),
    });
  }
}
