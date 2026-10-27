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
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatSelectModule } from "@angular/material/select";
import { form, FormField } from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { parseDate } from "../../tournaments/tournament.model";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import { Match } from "../match.model";
import { MatchesApi } from "../matches.api";
import {
  ProgramMatchDialogComponent,
  ProgramMatchDialogData,
} from "../program-match-dialog/program-match-dialog.component";
import { slotLabel, slotParts } from "../schedule.model";
import {
  PlayoffResultDialogComponent,
  PlayoffResultDialogData,
} from "../playoff-result-dialog/playoff-result-dialog.component";
import {
  BracketMatch,
  BracketPlayoff,
  BracketRound,
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
    MatTooltipModule,
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

  /** Hours, fields and referees can be set (the tournament is in its playoffs) */
  readonly schedulable = input(false);

  /** The hour, field or referee of a match changed: the data must be requested again */
  readonly programmed = output<void>();

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

  /** "Sáb 07/11 · 8:00 p.m. · Cancha 1" of a match that has an hour */
  slotText(match: BracketMatch): string {
    return slotLabel(match.match_datetime ?? "", match.field?.name, (weekday) =>
      this.transloco.translate(`matches.config.weekdays.${weekday}`),
    );
  }

  /** The last round of a liguilla: its matches are the finals */
  isFinal(playoff: BracketPlayoff, round: BracketRound): boolean {
    return round.index === playoff.rounds.at(-1)?.index;
  }

  /** "8:00 p.m." */
  timeOf(match: BracketMatch): string {
    return slotParts(match.match_datetime ?? "").time;
  }

  previousSlot(match: BracketMatch): string {
    return this.transloco.translate("matches.rescheduledHint", {
      slot: slotLabel(match.original_match_datetime ?? "", null, (weekday) =>
        this.transloco.translate(`matches.config.weekdays.${weekday}`),
      ),
    });
  }

  /** A match of the bracket as the dialog that sets its hour takes it */
  private toMatch(
    playoff: BracketPlayoff,
    round: BracketRound,
    match: BracketMatch,
  ): Match {
    const leg = this.legLabel(match);

    return {
      id: match.id,
      group_id: playoff.group_id,
      group_name: playoff.name,
      matchday: 0,
      round_number: 1,
      round_label: `${playoff.name} · ${round.name}${leg ? ` (${leg.toLowerCase()})` : ""}`,
      status: match.status,
      match_datetime: match.match_datetime ?? null,
      field: match.field ?? null,
      referee: match.referee ?? null,
      schedule_locked: match.schedule_locked ?? false,
      original_match_datetime: match.original_match_datetime ?? null,
      home: match.home_team,
      away: match.away_team,
      home_score: match.home_goals,
      away_score: match.away_goals,
    };
  }

  /** Sets the hour, field and referee of a match (it may still have teams to be defined) */
  program(
    playoff: BracketPlayoff,
    round: BracketRound,
    match: BracketMatch,
  ): void {
    if (!this.schedulable() || match.status !== "scheduled") {
      return;
    }

    this.dialog
      .open<ProgramMatchDialogComponent, ProgramMatchDialogData, boolean>(
        ProgramMatchDialogComponent,
        {
          data: {
            tournamentId: this.tournamentId(),
            match: this.toMatch(playoff, round, match),
            candidates: this.playoffs().flatMap((item) =>
              item.rounds.flatMap((r) =>
                r.ties.flatMap((tie) =>
                  tie.matches
                    .filter((m) => m.status === "scheduled")
                    .map((m) => this.toMatch(item, r, m)),
                ),
              ),
            ),
          },
          width: "720px",
          maxWidth: "95vw",
        },
      )
      .afterClosed()
      .subscribe((changed) => {
        if (changed) {
          this.programmed.emit();
        }
      });
  }

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
