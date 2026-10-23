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
import { firstValueFrom } from "rxjs";
import { form, FormField, validate } from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { failureMessage } from "../../../core/http/api-errors";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { FormSubmitService } from "../../../shared/form-submit/form-submit.service";
import { Match } from "../match.model";
import { MatchesApi } from "../matches.api";

export interface MatchResultDialogData {
  tournamentId: number;
  match: Match;
}

const MAX_SCORE = 99;

const validScore = (value: number | null): boolean =>
  value !== null && Number.isInteger(value) && value >= 0 && value <= MAX_SCORE;

/** Captures, changes or voids the score of a match. Closes with `true` once something was saved. */
@Component({
  selector: "app-match-result-dialog",
  templateUrl: "./match-result-dialog.component.html",
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
export class MatchResultDialogComponent {
  private readonly api = inject(MatchesApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialogRef =
    inject<MatDialogRef<MatchResultDialogComponent, boolean>>(MatDialogRef);
  private readonly formSubmit = inject(FormSubmitService);
  private readonly transloco = inject(TranslocoService);

  readonly data = inject<MatchResultDialogData>(MAT_DIALOG_DATA);

  readonly homeName = this.data.match.home?.team_name ?? "—";
  readonly awayName = this.data.match.away?.team_name ?? "—";
  readonly hasResult = this.data.match.status === "played";

  /** The backend's refusal (tournament not in progress, closed stage...) */
  readonly formError = signal<string | null>(null);
  readonly voiding = signal(false);

  private readonly model = signal<{
    home_score: number | null;
    away_score: number | null;
  }>({
    home_score: this.data.match.home_score,
    away_score: this.data.match.away_score,
  });

  readonly resultForm = form(this.model, (result) => {
    validate(result.home_score, ({ value }) =>
      validScore(value()) ? undefined : { kind: "score" },
    );
    validate(result.away_score, ({ value }) =>
      validScore(value()) ? undefined : { kind: "score" },
    );
  });

  scoreError(): string {
    return this.transloco.translate("matches.result.scoreError", {
      max: MAX_SCORE,
    });
  }

  save(): Promise<boolean> {
    this.formError.set(null);

    return this.formSubmit.submit(this.resultForm, {
      errors: "form",
      onFormError: (message) => this.formError.set(message),
      send: () =>
        this.api.setResult(
          this.data.tournamentId,
          this.data.match.id,
          this.model().home_score as number,
          this.model().away_score as number,
        ),
      onSuccess: () => this.dialogRef.close(true),
    });
  }

  /** Voids the result after confirming; the match goes back to scheduled */
  voidResult(): void {
    this.formError.set(null);
    this.confirmDialog
      .confirm({
        key: "matches.result.void",
        params: { home: this.homeName, away: this.awayName },
      })
      .subscribe(async (confirmed) => {
        if (!confirmed) {
          return;
        }

        this.voiding.set(true);

        try {
          await firstValueFrom(
            this.api.clearResult(this.data.tournamentId, this.data.match.id),
          );
          this.dialogRef.close(true);
        } catch (error) {
          this.formError.set(
            failureMessage(error, (key) => this.transloco.translate(key)),
          );
        } finally {
          this.voiding.set(false);
        }
      });
  }
}
