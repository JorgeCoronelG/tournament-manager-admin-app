import { DatePipe, NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  linkedSignal,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatSelectModule } from "@angular/material/select";
import { form, FormField } from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { injectIsMobile } from "../../../shared/responsive/is-mobile";
import {
  RowAction,
  RowActionsComponent,
} from "../../../shared/row-actions/row-actions.component";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { parseDate } from "../../tournaments/tournament.model";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import { Match } from "../match.model";
import {
  FinishTournamentDialogComponent,
  FinishTournamentDialogData,
} from "../finish-tournament-dialog/finish-tournament-dialog.component";
import {
  WalkoverDialogComponent,
  WalkoverDialogData,
} from "../walkover-dialog/walkover-dialog.component";
import { MatchesApi } from "../matches.api";
import {
  ProgramMatchDialogComponent,
  ProgramMatchDialogData,
} from "../program-match-dialog/program-match-dialog.component";
import { slotLabel } from "../schedule.model";
import {
  buildPlayoffResultsData,
  buildPlayoffScheduleData,
  downloadOptions,
  LegChoice,
  playoffFileName,
  roundResults,
} from "../playoff-image/playoff-image.model";
import { PlayoffResultsImageComponent } from "../playoff-image/playoff-results-image.component";
import { PlayoffScheduleImageComponent } from "../playoff-image/playoff-schedule-image.component";
import { StandingsExportService } from "../standings-export/standings-export.service";
import {
  PlayoffResultDialogComponent,
  PlayoffResultDialogData,
  PlayoffResultOutcome,
} from "../playoff-result-dialog/playoff-result-dialog.component";
import {
  BracketMatch,
  BracketPlayoff,
  BracketRound,
  BracketTeam,
  BracketTie,
  scoreText,
} from "../playoff.model";
import { SpinnerComponent } from "../../../shared/spinner/spinner.component";

/** The playoff bracket: a column per round, a card per tie, with the results the admin can capture while it is open */
@Component({
  selector: "app-bracket-view",
  templateUrl: "./bracket-view.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SpinnerComponent,
    DatePipe,
    FormField,
    NgTemplateOutlet,
    LogoImageComponent,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatMenuModule,
    MatSelectModule,
    MatTooltipModule,
    RowActionsComponent,
    TranslocoPipe,
  ],
})
export class BracketViewComponent {
  private readonly dialog = inject(MatDialog);
  private readonly exporter = inject(StandingsExportService);
  private readonly league = inject(LeagueContextService);
  private readonly matchesApi = inject(MatchesApi);
  private readonly snackbar = inject(SnackbarService);
  private readonly tournamentsApi = inject(TournamentsApi);
  private readonly transloco = inject(TranslocoService);

  protected readonly parseDate = parseDate;
  protected readonly isMobile = injectIsMobile();
  protected readonly downloadOptions = downloadOptions;

  readonly tournamentId = input.required<number>();
  readonly tournamentName = input.required<string>();
  readonly playoffs = input.required<readonly BracketPlayoff[]>();
  /** Only a tournament in its playoffs lets results be captured or the tournament be finished */
  readonly editable = input(false);

  /** Goals the winner of a default win gets */
  readonly walkoverGoals = input(3);

  /** Registrations withdrawn from the tournament: their pending matches cannot get a score */
  readonly withdrawnIds = input<ReadonlySet<number>>(new Set());

  /** Only to look at (the history of a finished tournament): every match is played, so the "played" chip is noise */
  readonly readOnly = input(false);

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

  protected readonly roundResults = roundResults;

  /** Rounds the user opened or closed on a phone; a new bracket (after a reload) starts over */
  private readonly toggled = linkedSignal<
    readonly BracketPlayoff[],
    Record<string, boolean>
  >({ source: this.playoffs, computation: () => ({}) });

  /** On a phone a round is a block: the current one is open (the last one when the tournament is over) */
  isOpen(playoff: BracketPlayoff, round: BracketRound): boolean {
    const key = `${playoff.group_id}:${round.index}`;
    const hasCurrent = playoff.rounds.some((r) => this.isCurrent(playoff, r));

    return (
      this.toggled()[key] ??
      (hasCurrent
        ? this.isCurrent(playoff, round)
        : round.index === playoff.rounds.at(-1)?.index)
    );
  }

  toggleRound(playoff: BracketPlayoff, round: BracketRound): void {
    const key = `${playoff.group_id}:${round.index}`;
    const open = this.isOpen(playoff, round);

    this.toggled.update((state) => ({ ...state, [key]: !open }));
  }

  /** The side that won a played match (goals, then penalties); null while it is not played or tied */
  matchWinner(match: BracketMatch): "home" | "away" | null {
    if (match.status !== "played") {
      return null;
    }

    const { home_goals: hg, away_goals: ag } = match;
    const [home, away] =
      hg !== null && ag !== null && hg !== ag
        ? [hg, ag]
        : [match.home_penalties, match.away_penalties];

    return home === null || away === null || home === away
      ? null
      : home > away
        ? "home"
        : "away";
  }

  /** The "⋮" of a match on a phone: program, default win and result */
  matchActions(
    playoff: BracketPlayoff,
    round: BracketRound,
    tie: BracketTie,
    match: BracketMatch,
  ): RowAction[] {
    const scheduled = match.status === "scheduled";
    const actions: RowAction[] = [];

    if (this.schedulable() && scheduled) {
      actions.push({
        icon: "mat:calendar_month",
        labelKey: "matches.program.action",
        run: () => this.program(playoff, round, match),
      });
    }

    if (!this.editable() || !this.hasTeams(match)) {
      return actions;
    }

    if (scheduled) {
      actions.push({
        icon: "mat:flag",
        labelKey: "matches.walkover.action",
        run: () => this.walkover(match),
      });
    }

    const locked = this.hasLaterResults(playoff, round);
    const withdrawn = this.hasWithdrawn(match);
    const hintKey = locked
      ? "matches.bracket.resultLocked"
      : withdrawn
        ? "matches.result.withdrawnTooltip"
        : null;

    actions.push({
      icon: "mat:scoreboard",
      labelKey:
        match.status === "played"
          ? "matches.result.editTooltip"
          : "matches.bracket.register",
      run: () => this.editResult(tie, match),
      disabled: locked || withdrawn,
      hint: hintKey ? this.transloco.translate(hintKey) : undefined,
    });

    return actions;
  }

  /** Index of the round whose image is being generated */
  protected readonly exportingImage = signal<number | null>(null);

  /** Generates the schedule or results image of a round (or one of its legs) and downloads it */
  async download(
    playoff: BracketPlayoff,
    round: BracketRound,
    kind: "schedule" | "results",
    choice: LegChoice,
  ): Promise<void> {
    if (this.exportingImage() !== null) {
      return;
    }

    this.exportingImage.set(round.index);

    const t = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(`matches.${key}`, params);

    try {
      const tournamentName = this.tournamentName();
      const input = {
        leagueName: this.league.activeLeague()?.name ?? "",
        tournamentName,
        playoffsCount: this.playoffs().length,
        playoff,
        round,
        choice,
        texts: {
          liguilla: t("playoffImage.liguilla"),
          first: t("playoffImage.first"),
          second: t("playoffImage.second"),
          both: t("playoffImage.bothSubtitle"),
          tbd: t("bracket.tbd"),
          winnerOf: (name: string, n: number) =>
            t("bracket.winnerOf", { round: name, n }),
        },
      };
      const fileName = (prefix: "horarios" | "resultados") =>
        playoffFileName(
          prefix,
          round.name,
          this.playoffs().length > 1 ? playoff.name : null,
          round.legs === 2 ? choice : null,
          tournamentName,
        );

      if (kind === "results") {
        await this.exporter.exportComponent(
          PlayoffResultsImageComponent,
          buildPlayoffResultsData({
            ...input,
            title: t("jornadaImage.results"),
          }),
          fileName("resultados"),
          tournamentName,
        );
      } else {
        await this.exporter.exportComponent(
          PlayoffScheduleImageComponent,
          buildPlayoffScheduleData({
            ...input,
            weekdayName: (weekday) => t(`config.weekdays.${weekday}`),
          }),
          fileName("horarios"),
          tournamentName,
        );
      }
    } catch {
      this.snackbar.error(t("standings.export.error"));
    } finally {
      this.exportingImage.set(null);
    }
  }

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

  /** The round being played: the first one with a tie still undecided */
  isCurrent(playoff: BracketPlayoff, round: BracketRound): boolean {
    return (
      playoff.rounds.find((r) =>
        r.ties.some((tie) => tie.winner_registration_id === null),
      )?.index === round.index
    );
  }

  /** A later round already has a result: this round's can no longer be changed */
  hasLaterResults(playoff: BracketPlayoff, round: BracketRound): boolean {
    return playoff.rounds.some(
      (later) =>
        later.index > round.index &&
        later.ties.some((tie) =>
          tie.matches.some((match) => match.status === "played"),
        ),
    );
  }

  /** "Ganador semifinal 1": the tie of the previous round that feeds a side that is not defined yet */
  feederLabel(
    playoff: BracketPlayoff,
    round: BracketRound,
    tieIndex: number,
    side: "a" | "b",
  ): string | null {
    const previous = playoff.rounds[playoff.rounds.indexOf(round) - 1];

    return previous
      ? this.transloco.translate("matches.bracket.winnerOf", {
          round: previous.name.toLowerCase(),
          n: tieIndex * 2 + (side === "a" ? 1 : 2),
        })
      : null;
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
          autoFocus: "dialog",
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
          panelClass: this.isMobile() ? "app-dialog-fullscreen" : "",
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
      .open<
        PlayoffResultDialogComponent,
        PlayoffResultDialogData,
        PlayoffResultOutcome
      >(PlayoffResultDialogComponent, {
        data: { tournamentId: this.tournamentId(), tie, match },
        width: "560px",
        maxWidth: "95vw",
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.changed.emit();
          this.snackbar.notifySuccess(
            saved === "voided"
              ? "matches.result.voided"
              : "matches.result.saved",
          );
        }
      });
  }

  /** A side of the match is withdrawn and it has no result yet */
  hasWithdrawn(match: BracketMatch): boolean {
    return (
      match.status === "scheduled" &&
      [match.home_team, match.away_team].some(
        (team) =>
          team !== null && this.withdrawnIds().has(team.registration_id),
      )
    );
  }

  /** The only withdrawn side of the match, to preselect it as the loser */
  private withdrawnLoser(match: BracketMatch): number | undefined {
    const withdrawn = [match.home_team, match.away_team].filter(
      (team) => team !== null && this.withdrawnIds().has(team.registration_id),
    );

    return withdrawn.length === 1 ? withdrawn[0]?.registration_id : undefined;
  }

  /** Registers a default win: it decides the whole tie */
  walkover(match: BracketMatch): void {
    const { home_team: home, away_team: away } = match;

    if (!this.editable() || !home || !away) {
      return;
    }

    this.dialog
      .open<WalkoverDialogComponent, WalkoverDialogData, boolean>(
        WalkoverDialogComponent,
        {
          data: {
            tournamentId: this.tournamentId(),
            matchId: match.id,
            home: {
              registration_id: home.registration_id,
              name: home.team_name,
            },
            away: {
              registration_id: away.registration_id,
              name: away.team_name,
            },
            goals: this.walkoverGoals(),
            playoff: true,
            loserRegistrationId: this.withdrawnLoser(match),
          },
          width: "520px",
          maxWidth: "95vw",
          autoFocus: "dialog",
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.changed.emit();
          this.snackbar.notifySuccess("matches.walkover.saved");
        }
      });
  }

  finish(): void {
    if (!this.editable()) {
      return;
    }

    this.dialog
      .open<
        FinishTournamentDialogComponent,
        FinishTournamentDialogData,
        boolean
      >(FinishTournamentDialogComponent, {
        autoFocus: "dialog",
        data: {
          tournamentName: this.tournamentName(),
          champions: this.playoffs().flatMap((playoff) =>
            playoff.champion
              ? [{ liguilla: playoff.name, team: playoff.champion.team_name }]
              : [],
          ),
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.tournamentsApi
          .setStatus(this.tournamentId(), "finished")
          .subscribe({
            next: () => {
              this.finished.emit();
              this.snackbar.notifySuccess("matches.finished");
            },
            error: (error: unknown) => this.snackbar.notifyFailure(error),
          });
      });
  }
}
