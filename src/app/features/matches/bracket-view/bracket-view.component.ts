import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatSelectModule } from "@angular/material/select";
import { form, FormField } from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { parseDate } from "../../tournaments/tournament.model";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import { MatchesApi } from "../matches.api";
import {
  PlayoffResultDialogComponent,
  PlayoffResultDialogData,
} from "../playoff-result-dialog/playoff-result-dialog.component";
import {
  BracketMatch,
  BracketPlayoff,
  BracketTeam,
  BracketTie,
  scoreText,
} from "../playoff.model";

/** The playoff bracket: a column per round, a card per tie, with the results the admin can capture while it is open */
@Component({
  selector: "app-bracket-view",
  templateUrl: "./bracket-view.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormField,
    LogoImageComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    TranslocoPipe,
  ],
})
export class BracketViewComponent {
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly matchesApi = inject(MatchesApi);
  private readonly snackbar = inject(SnackbarService);
  private readonly tournamentsApi = inject(TournamentsApi);
  private readonly transloco = inject(TranslocoService);

  protected readonly parseDate = parseDate;

  readonly tournamentId = input.required<number>();
  readonly tournamentName = input.required<string>();
  readonly playoffs = input.required<readonly BracketPlayoff[]>();
  /** Only a tournament in its playoffs lets results be captured or the tournament be finished */
  readonly editable = input(false);

  /** A result was saved or voided, or the tournament was finished: the data must be requested again */
  readonly changed = output<void>();
  readonly finished = output<void>();

  /** Which playoff is open when there are several */
  readonly pick = signal<{ playoff: number }>({ playoff: 0 });
  readonly pickForm = form(this.pick);

  readonly current = computed(() => this.playoffs()[this.pick().playoff]);

  /** Every tie of every playoff already has a winner: the tournament can be finished */
  readonly allDecided = computed(
    () =>
      this.playoffs().length > 0 &&
      this.playoffs().every((playoff) =>
        playoff.rounds.every((round) =>
          round.ties.every((tie) => tie.winner_registration_id !== null),
        ),
      ),
  );

  /** "Ida", "Vuelta" or nothing for a single match */
  legLabel(match: BracketMatch): string | null {
    return match.leg === null
      ? null
      : this.transloco.translate(
          match.leg === 1 ? "matches.bracket.first" : "matches.bracket.second",
        );
  }

  score(match: BracketMatch): string | null {
    return scoreText(match, this.transloco.translate("matches.bracket.pen"));
  }

  hasTeams(match: BracketMatch): boolean {
    return match.home_team !== null && match.away_team !== null;
  }

  isWinner(tie: BracketTie, team: BracketTeam | null): boolean {
    return (
      team !== null &&
      tie.winner_registration_id !== null &&
      tie.winner_registration_id === team.registration_id
    );
  }

  seedOf(tie: BracketTie, side: "a" | "b"): number | null {
    return side === "a" ? tie.seed_a : tie.seed_b;
  }

  /** Registers or edits the score of a match */
  editResult(tie: BracketTie, match: BracketMatch): void {
    if (!this.editable() || !this.hasTeams(match)) {
      return;
    }

    this.dialog
      .open<PlayoffResultDialogComponent, PlayoffResultDialogData, boolean>(
        PlayoffResultDialogComponent,
        {
          data: { tournamentId: this.tournamentId(), tie, match },
          width: "560px",
          maxWidth: "95vw",
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.changed.emit();
          this.snackbar.notifySuccess("matches.result.saved");
        }
      });
  }

  voidResult(match: BracketMatch): void {
    if (!this.editable()) {
      return;
    }

    this.confirmDialog
      .confirm({
        key: "matches.result.void",
        params: {
          home: match.home_team?.team_name ?? "—",
          away: match.away_team?.team_name ?? "—",
        },
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.matchesApi.clearResult(this.tournamentId(), match.id).subscribe({
          next: () => {
            this.changed.emit();
            this.snackbar.notifySuccess("matches.result.voided");
          },
          error: (error: unknown) => this.snackbar.notifyFailure(error),
        });
      });
  }

  finish(): void {
    if (!this.editable()) {
      return;
    }

    this.confirmDialog
      .confirm({
        key: "tournaments.finish",
        params: { name: this.tournamentName() },
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.tournamentsApi
          .setStatus(this.tournamentId(), "finished")
          .subscribe({
            next: () => {
              this.finished.emit();
              this.snackbar.notifySuccess("tournaments.finished");
            },
            error: (error: unknown) => this.snackbar.notifyFailure(error),
          });
      });
  }
}
