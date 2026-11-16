import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatTabsModule } from "@angular/material/tabs";
import { MatTooltipModule } from "@angular/material/tooltip";
import { form, FormField } from "@angular/forms/signals";
import { ActivatedRoute, Router } from "@angular/router";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { map } from "rxjs";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { LeagueRequiredComponent } from "../../../shared/league-required/league-required.component";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import {
  GenerateMatchesDialogComponent,
  GenerateMatchesDialogData,
} from "../generate-matches-dialog/generate-matches-dialog.component";
import {
  AssignScheduleDialogComponent,
  AssignScheduleDialogData,
} from "../assign-schedule-dialog/assign-schedule-dialog.component";
import { AgendaViewComponent } from "../agenda-view/agenda-view.component";
import { ScheduleApi } from "../schedule.api";
import { ScheduleConfigApi } from "../schedule-config.api";
import { datesRange, slotLabel } from "../schedule.model";
import {
  ScheduleConfigDialogComponent,
  ScheduleConfigDialogData,
} from "../schedule-config-dialog/schedule-config-dialog.component";
import {
  ProgramMatchDialogComponent,
  ProgramMatchDialogData,
} from "../program-match-dialog/program-match-dialog.component";
import {
  MatchResultDialogComponent,
  MatchResultDialogData,
} from "../match-result-dialog/match-result-dialog.component";
import {
  byRound,
  GenerateResult,
  GroupSchedule,
  hasPlayedMatches,
  Match,
  matchCount,
  MatchSide,
  playedCount,
} from "../match.model";
import { MatchesApi } from "../matches.api";
import { BracketViewComponent } from "../bracket-view/bracket-view.component";
import {
  ClosePhaseDialogComponent,
  ClosePhaseDialogData,
  ClosePhaseResult,
} from "../close-phase-dialog/close-phase-dialog.component";
import { PlayoffsApi } from "../playoffs.api";
import { RegistrationsApi } from "../../registrations/registrations.api";
import {
  WalkoverDialogComponent,
  WalkoverDialogData,
} from "../walkover-dialog/walkover-dialog.component";
import { GroupsApi } from "../../groups/groups.api";

/** Up to this many matchdays every section starts open; with more, only the first */
const OPEN_ALL_UP_TO = 4;

/** The regular-phase calendar of a tournament: who plays whom each matchday */
@Component({
  selector: "app-matches-page",
  templateUrl: "./matches-page.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AgendaViewComponent,
    AppBreadcrumbsComponent,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
    BracketViewComponent,
    FormField,
    LeagueRequiredComponent,
    LogoImageComponent,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule,
    NgTemplateOutlet,
    TranslocoPipe,
  ],
})
export class MatchesPageComponent {
  private readonly api = inject(MatchesApi);
  private readonly playoffsApi = inject(PlayoffsApi);
  private readonly groupsApi = inject(GroupsApi);
  private readonly registrationsApi = inject(RegistrationsApi);
  private readonly scheduleApi = inject(ScheduleApi);
  private readonly configApi = inject(ScheduleConfigApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  protected readonly leagueContext = inject(LeagueContextService);

  protected readonly tournamentsResource = inject(TournamentsApi).options([
    "in_progress",
    "playoffs",
  ]);
  readonly tournaments = computed(() =>
    this.tournamentsResource.hasValue()
      ? this.tournamentsResource.value().data
      : [],
  );

  /** The tournament picker ("" until one is chosen) */
  readonly picker = signal<{ tournament: number | "" }>({ tournament: "" });
  readonly pickerForm = form(this.picker);

  readonly tournament = computed(() => {
    const id = this.picker().tournament;

    return this.tournaments().find((item) => item.id === id);
  });

  /** `?torneo=ID`: the tournament a link (the agenda's "Ver calendario") asks for */
  private readonly requested = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => Number(params.get("torneo")) || null),
    ),
    { initialValue: null },
  );
  private readonly preselect = effect(() => {
    const id = this.requested();

    if (
      id !== null &&
      this.tournaments().some((item) => item.id === id) &&
      untracked(this.picker).tournament === ""
    ) {
      untracked(() => this.picker.set({ tournament: id }));
    }
  });

  // A tournament that is no longer in the league (another league was picked) is dropped
  private readonly dropGoneTournament = effect(() => {
    if (
      this.picker().tournament !== "" &&
      this.tournamentsResource.hasValue() &&
      !this.tournament()
    ) {
      this.picker.set({ tournament: "" });
    }
  });

  /** The playoff stage has started: the bracket exists */
  readonly inPlayoffs = computed(() => {
    const status = this.tournament()?.status;

    return status === "playoffs" || status === "finished";
  });

  /** Results of the bracket can be captured only while the tournament is in its playoffs */
  readonly bracketEditable = computed(
    () => this.tournament()?.status === "playoffs",
  );

  readonly bracketResource = this.playoffsApi.bracket(
    computed(() => (this.inPlayoffs() ? this.tournament()?.id : undefined)),
  );
  readonly bracket = computed(() =>
    this.bracketResource.hasValue()
      ? this.bracketResource.value().playoffs
      : [],
  );

  /** The tournament's playoffs, to know whether the regular phase can be closed; only asked while in progress */
  private readonly groupsResource = this.groupsApi.view(
    computed(() =>
      this.tournament()?.status === "in_progress"
        ? this.tournament()?.id
        : undefined,
    ),
  );
  readonly hasPlayoffs = computed(
    () => (this.groupsResource.value()?.playoffs.length ?? 0) > 0,
  );

  /** Closing needs a tournament in progress with playoffs to start and a calendar already generated */
  readonly canClose = computed(
    () => this.editable() && this.hasPlayoffs() && this.generated(),
  );

  /** Latest dated match of the regular phase: what the first playoff date must follow */
  readonly lastRegularDate = computed(() => {
    const dates = this.groups()
      .flatMap((group) => group.matchdays)
      .flatMap((day) => day.matches)
      .map((match) => match.match_datetime)
      .filter((date): date is string => !!date)
      .map((date) => date.slice(0, 10))
      .sort();

    return dates.at(-1) ?? null;
  });

  /** After closing the phase the bracket tab opens by itself once the tournament shows as in its playoffs */
  private readonly showBracketNext = signal(false);
  private readonly openBracket = effect(() => {
    if (this.showBracketNext() && this.inPlayoffs()) {
      this.selectedSection.set(1);
      this.showBracketNext.set(false);
    }
  });

  /** Hours and fields are configured only while the tournament is in progress (not in planning, nor from the playoffs on) */
  readonly configurable = computed(
    () =>
      this.tournament()?.status === "in_progress" ||
      this.tournament()?.status === "playoffs",
  );

  /** The hours being set are those of the bracket, not the regular phase's */
  readonly scheduling = computed<"regular" | "playoffs">(() =>
    this.tournament()?.status === "playoffs" ? "playoffs" : "regular",
  );

  /** A tournament in planning has no calendar to ask for */
  readonly started = computed(() => {
    const status = this.tournament()?.status;

    return status !== undefined && status !== "planning";
  });

  /** Only a tournament in progress generates, replaces or deletes its calendar */
  readonly editable = computed(
    () => this.tournament()?.status === "in_progress",
  );

  private readonly registrationsResource = this.registrationsApi.all(
    computed(() =>
      this.tournament()?.status === "in_progress" ||
      this.tournament()?.status === "playoffs"
        ? this.tournament()?.id
        : undefined,
    ),
  );

  /** Registrations withdrawn from the tournament */
  readonly withdrawnIds = computed(
    () =>
      new Set(
        this.registrationsResource
          .value()
          ?.data.filter((registration) => registration.status === "withdrawn")
          .map((registration) => registration.id) ?? [],
      ),
  );

  /** Withdrawn registrations that still have pending matches, and how many pending matches they have */
  private readonly withdrawnPending = computed(() => {
    const withdrawn = this.withdrawnIds();
    const teams = new Set<number>();
    let matches = 0;
    const count = (home?: number, away?: number) => {
      const ids = [home, away].filter(
        (id): id is number => id !== undefined && withdrawn.has(id),
      );

      if (ids.length) {
        matches++;
        ids.forEach((id) => teams.add(id));
      }
    };

    for (const group of this.groups()) {
      for (const day of group.matchdays) {
        for (const match of day.matches) {
          if (match.status === "scheduled") {
            count(match.home?.registration_id, match.away?.registration_id);
          }
        }
      }
    }

    for (const playoff of this.bracket()) {
      for (const round of playoff.rounds) {
        for (const tie of round.ties) {
          for (const match of tie.matches) {
            if (match.status === "scheduled") {
              count(
                match.home_team?.registration_id,
                match.away_team?.registration_id,
              );
            }
          }
        }
      }
    }

    return { teams: teams.size, matches };
  });
  readonly withdrawnCount = computed(() => this.withdrawnPending().teams);
  readonly withdrawnMatches = computed(() => this.withdrawnPending().matches);

  /** A side of a pending match that is withdrawn: its score cannot be captured */
  isWithdrawn(side: MatchSide | null): boolean {
    return side !== null && this.withdrawnIds().has(side.registration_id);
  }

  /** The match has a withdrawn side and no result yet */
  hasWithdrawn(match: Match): boolean {
    return (
      match.status === "scheduled" &&
      (this.isWithdrawn(match.home) || this.isWithdrawn(match.away))
    );
  }

  /** Hours can be assigned once the calendar of pairings exists */
  readonly assignable = computed(() =>
    this.scheduling() === "playoffs"
      ? this.bracket().length > 0
      : this.editable() && this.generated(),
  );

  private readonly configResource = this.configApi.config(
    computed(() => (this.assignable() ? this.tournament()?.id : undefined)),
  );
  private readonly capacityResource = this.configApi.capacity(
    computed(() => (this.assignable() ? this.tournament()?.id : undefined)),
  );

  /** Without play days there is nothing to assign matches to */
  readonly hasConfig = computed(
    () => (this.configResource.value()?.windows.length ?? 0) > 0,
  );

  /** Matches fixed by hand that fall outside the configured hours */
  readonly lockedOutside = computed(
    () => this.capacityResource.value()?.locked_outside_schedule ?? 0,
  );

  /** The assigned hours no longer match the configuration */
  readonly outdated = computed(
    () => this.capacityResource.value()?.schedule_outdated === true,
  );

  /** Matches of a group still to be played that have no date yet */
  unscheduledOf(group: GroupSchedule): number {
    return group.matchdays
      .flatMap((day) => day.matches)
      .filter((match) => match.status !== "played" && !match.match_datetime)
      .length;
  }

  readonly resource = this.api.schedule(
    computed(() => (this.started() ? this.tournament()?.id : undefined)),
  );
  /** The calendar is asked again (a result, a new hour...) */
  private reloadAll(): void {
    this.resource.reload();
  }

  readonly schedule = computed(() =>
    this.resource.hasValue() ? this.resource.value() : undefined,
  );
  readonly generated = computed(() => this.schedule()?.generated === true);
  readonly groups = computed(() => this.schedule()?.groups ?? []);

  /** The group whose counters the toolbar shows: the open tab (the only group when there is one) */
  readonly currentGroup = computed(
    () => this.groups()[this.selectedTab()] ?? this.groups()[0],
  );

  /** Played matches freeze the calendar */
  readonly locked = computed(() => hasPlayedMatches(this.schedule()));

  readonly crumbs = computed(() => [
    this.transloco.translate("nav.tournaments"),
    this.transloco.translate("nav.schedule"),
  ]);

  /** The top tab: "Por torneo" (0) or the league's agenda (1) */
  readonly selectedMain = signal(0);

  /** A tournament's link in the agenda: its calendar opens in "Por torneo" */
  openCalendar(tournamentId: number): void {
    this.picker.set({ tournament: tournamentId });
    this.selectedMain.set(0);
  }

  /** The section tab: the calendar, or the bracket (only once the playoffs started) */
  readonly selectedSection = signal(0);

  readonly clearLabel = computed(() =>
    this.scheduling() === "playoffs"
      ? "matches.clearPlayoffSchedule.action"
      : "matches.clearSchedule.action",
  );

  /** The group tab (by position) the user has open; the first one by default */
  readonly selectedTab = signal(0);

  /** A group's matchdays split by round, with the counters shown above them */
  roundsOf(group: GroupSchedule) {
    return byRound(group.matchdays);
  }

  playedOf(group: GroupSchedule): number {
    return playedCount(group);
  }

  matchesOf(group: GroupSchedule): number {
    return matchCount(group);
  }

  /** Several rounds (double round-robin) get a heading each */
  hasSeveralRounds(group: GroupSchedule): boolean {
    return this.roundsOf(group).length > 1;
  }

  /**
   * Short calendars open every section; long ones only the first. In the
   * playoffs the regular phase is over: every section starts closed
   */
  isOpen(group: GroupSchedule, matchday: number): boolean {
    if (this.tournament()?.status === "playoffs") {
      return false;
    }

    return (
      group.matchdays.length <= OPEN_ALL_UP_TO ||
      matchday === group.matchdays[0]?.matchday
    );
  }

  /** "Sáb 07/11 · 8:00 a.m. · Cancha 1" */
  slotText(match: Match): string {
    return slotLabel(match.match_datetime ?? "", match.field?.name, (weekday) =>
      this.transloco.translate(`matches.config.weekdays.${weekday}`),
    );
  }

  /** "Antes: Sáb 07/11 · 8:00 a.m." for a match that was moved by hand */
  previousSlot(match: Match): string {
    return this.transloco.translate("matches.rescheduledHint", {
      slot: slotLabel(match.original_match_datetime ?? "", null, (weekday) =>
        this.transloco.translate(`matches.config.weekdays.${weekday}`),
      ),
    });
  }

  /** "02/11 - 08/11" when the matchday has dated matches */
  rangeOf(matches: Match[]): string | null {
    return datesRange(matches);
  }

  /** The assigned slots changed: the calendar and the outdated notice are asked again */
  reloadSchedule(): void {
    this.resource.reload();
    this.bracketResource.reload();
    this.capacityResource.reload();
  }

  assignSchedule(): void {
    const tournament = this.tournament();

    if (!tournament || !this.assignable() || !this.hasConfig()) {
      return;
    }

    this.dialog
      .open<AssignScheduleDialogComponent, AssignScheduleDialogData, boolean>(
        AssignScheduleDialogComponent,
        {
          autoFocus: "dialog",
          data: { tournamentId: tournament.id, phase: this.scheduling() },
          width: this.scheduling() === "playoffs" ? "560px" : "960px",
          maxWidth: "95vw",
        },
      )
      .afterClosed()
      .subscribe((assigned) => {
        if (assigned) {
          this.reloadSchedule();
          this.snackbar.notifySuccess("matches.assign.assigned");
        }
      });
  }

  /**
   * What "Quitar horarios" would do with the matches already loaded: the ones
   * with a time that are still to be played and not fixed lose it; the fixed
   * and the played ones stay.
   */
  readonly clearable = computed(() => {
    const slots =
      this.scheduling() === "playoffs"
        ? this.bracket().flatMap((playoff) =>
            playoff.rounds.flatMap((round) =>
              round.ties.flatMap((tie) =>
                tie.matches.map((match) => ({
                  hasTime: !!match.match_datetime,
                  status: match.status,
                  locked: match.schedule_locked === true,
                })),
              ),
            ),
          )
        : this.groups().flatMap((group) =>
            group.matchdays.flatMap((day) =>
              day.matches.map((match) => ({
                hasTime: !!match.match_datetime,
                status: match.status,
                locked: match.schedule_locked === true,
              })),
            ),
          );

    return {
      cleared: slots.filter(
        (slot) => slot.hasTime && slot.status === "scheduled" && !slot.locked,
      ).length,
    };
  });

  clearSchedule(): void {
    const tournament = this.tournament();

    if (!tournament || !this.assignable()) {
      return;
    }

    const { cleared } = this.clearable();

    if (cleared === 0) {
      this.snackbar.info(
        this.transloco.translate("matches.clearSchedule.nothing"),
      );

      return;
    }

    const base =
      this.scheduling() === "playoffs"
        ? "matches.clearPlayoffSchedule"
        : "matches.clearSchedule";

    this.confirmDialog
      .confirm({
        key: cleared === 1 ? `${base}One` : base,
        params: { count: cleared },
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.scheduleApi.clear(tournament.id, this.scheduling()).subscribe({
          next: ({ cleared }) => {
            this.reloadSchedule();
            this.snackbar.notifySuccess("matches.clearSchedule.cleared", {
              count: cleared,
            });
          },
          error: (error: unknown) => this.snackbar.notifyFailure(error),
        });
      });
  }

  restingNames(resting: ReadonlyArray<{ team_name: string }>): string {
    return resting.map((team) => team.team_name).join(", ");
  }

  configureSchedule(): void {
    const tournament = this.tournament();

    if (!tournament || !this.configurable()) {
      return;
    }

    this.dialog
      .open<ScheduleConfigDialogComponent, ScheduleConfigDialogData, boolean>(
        ScheduleConfigDialogComponent,
        {
          data: {
            tournamentId: tournament.id,
            matchDuration: tournament.match_duration_minutes,
            tournamentStartDate: tournament.start_date,
            playoffs: this.scheduling() === "playoffs",
          },
          width: "960px",
          maxWidth: "95vw",
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.configResource.reload();
          this.capacityResource.reload();
          this.snackbar.notifySuccess("matches.config.saved");
        }
      });
  }

  generate(): void {
    this.openDialog(false);
  }

  regenerate(): void {
    this.openDialog(true);
  }

  /** What regenerating throws away of the regular phase, as loaded: assigned times, fixed ones and referees */
  private readonly assignments = computed(() => {
    const matches = this.groups()
      .flatMap((group) => group.matchdays)
      .flatMap((day) => day.matches);

    return {
      total: matches.length,
      scheduled: matches.filter((match) => match.match_datetime).length,
      locked: matches.filter((match) => match.schedule_locked).length,
      referees: matches.filter((match) => match.referee).length,
    };
  });

  /** "Se perderán 15 partidos (2 fijados), 12 horarios asignados y 3 asignaciones de árbitro."; zero counts are left out */
  private lossText(): string {
    const { total, scheduled, locked, referees } = this.assignments();
    const t = (base: string, count: number) =>
      this.transloco.translate(
        `matches.delete.${base}${count === 1 ? "One" : "Many"}`,
        {
          count,
        },
      );
    const parts: string[] = [];

    if (total > 0) {
      parts.push(
        t("matches", total) + (locked > 0 ? ` ${t("locked", locked)}` : ""),
      );
    }

    if (scheduled > 0) {
      parts.push(t("schedules", scheduled));
    }

    if (referees > 0) {
      parts.push(t("referees", referees));
    }

    const what =
      parts.length === 1
        ? parts[0]
        : `${parts.slice(0, -1).join(", ")} ${this.transloco.translate("matches.regenerate.and")} ${parts.at(-1)}`;

    return this.transloco.translate("matches.delete.lost", { what });
  }

  private openDialog(regenerate: boolean): void {
    const tournament = this.tournament();

    if (!tournament || !this.editable() || (regenerate && this.locked())) {
      return;
    }

    this.dialog
      .open<
        GenerateMatchesDialogComponent,
        GenerateMatchesDialogData,
        GenerateResult
      >(GenerateMatchesDialogComponent, {
        data: {
          tournamentId: tournament.id,
          rounds: tournament.rounds,
          regenerate,
          assignments: this.assignments(),
        },
        // Focus the dialog itself, not the first control: nothing looks selected
        autoFocus: "dialog",
        width: "480px",
        maxWidth: "95vw",
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.reloadAll();
          this.selectedTab.set(0);
          this.snackbar.notifySuccess(
            regenerate ? "matches.regenerated" : "matches.generated",
          );
        }
      });
  }

  remove(): void {
    const tournament = this.tournament();

    if (!tournament || !this.editable() || this.locked()) {
      return;
    }

    this.confirmDialog
      .confirm({
        key: "matches.delete",
        params: { name: tournament.name, loss: this.lossText() },
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.api.remove(tournament.id).subscribe({
          next: () => {
            this.reloadAll();
            this.snackbar.notifySuccess("matches.deleted");
          },
          error: (error: unknown) => this.snackbar.notifyFailure(error),
        });
      });
  }

  /** Opens the closing of the regular phase: what blocks it, or the playoffs to confirm */
  closePhase(): void {
    const tournament = this.tournament();

    if (!tournament || !this.canClose()) {
      return;
    }

    this.dialog
      .open<ClosePhaseDialogComponent, ClosePhaseDialogData, ClosePhaseResult>(
        ClosePhaseDialogComponent,
        {
          data: {
            tournamentId: tournament.id,
            lastRegularDate: this.lastRegularDate(),
            matchDuration: tournament.match_duration_minutes,
            tournamentStartDate: tournament.start_date,
            withdrawnCount: this.withdrawnIds().size,
          },
          width: "720px",
          maxWidth: "95vw",
          autoFocus: "dialog",
        },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result === "standings") {
          // The standings table lives in Estadísticas now
          void this.router.navigate(["/dashboard/torneos/estadisticas"], {
            queryParams: { torneo: tournament.id },
          });
        } else if (result === "closed") {
          this.showBracketNext.set(true);
          this.tournamentsResource.reload();
          this.reloadAll();
          this.snackbar.notifySuccess("matches.close.closed");
        }
      });
  }

  /** A result of the bracket changed, or the tournament was finished */
  reloadBracket(): void {
    this.bracketResource.reload();
  }

  reloadTournament(): void {
    this.tournamentsResource.reload();
    this.bracketResource.reload();
  }

  /** Sets the hour, field and referee of a match by hand, or swaps it with another */
  programMatch(match: Match): void {
    const tournament = this.tournament();

    if (!tournament || !this.editable() || match.status !== "scheduled") {
      return;
    }

    this.dialog
      .open<ProgramMatchDialogComponent, ProgramMatchDialogData, boolean>(
        ProgramMatchDialogComponent,
        {
          autoFocus: "dialog",
          data: {
            tournamentId: tournament.id,
            match,
            hasSeveralGroups: this.groups().length > 1,
            candidates: this.groups()
              .flatMap((group) => group.matchdays)
              .flatMap((day) => day.matches)
              .filter((other) => other.status === "scheduled"),
          },
          width: "720px",
          maxWidth: "95vw",
        },
      )
      .afterClosed()
      .subscribe((changed) => {
        if (changed) {
          this.reloadSchedule();
        }
      });
  }

  /** Opens the score of a match to capture, change or void it */
  editResult(match: Match): void {
    const tournament = this.tournament();

    if (!tournament || !this.editable()) {
      return;
    }

    this.dialog
      .open<MatchResultDialogComponent, MatchResultDialogData, boolean>(
        MatchResultDialogComponent,
        {
          data: { tournamentId: tournament.id, match },
          width: "560px",
          maxWidth: "95vw",
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reloadAll();
          this.snackbar.notifySuccess("matches.result.saved");
        }
      });
  }

  /** The only withdrawn side of the match, to preselect it as the loser */
  private withdrawnLoser(match: Match): number | undefined {
    const sides = [match.home, match.away].filter((side) =>
      this.isWithdrawn(side),
    );

    return sides.length === 1 ? sides[0]?.registration_id : undefined;
  }

  /**
   * In a played match the winner stands out in bold and the loser (and its
   * score) fades; a draw leaves the names as they are
   */
  resultClass(match: Match, side: "home" | "away"): string {
    const { home_score: home, away_score: away } = match;

    if (
      match.status !== "played" ||
      home == null ||
      away == null ||
      home === away
    ) {
      return "font-medium";
    }

    const won = side === "home" ? home > away : away > home;

    return won ? "font-bold" : "font-medium text-gray-400 dark:text-gray-500";
  }

  /** Like `resultClass`, but in a draw the score is the one in bold */
  scoreClass(match: Match, side: "home" | "away"): string {
    const draw =
      match.status === "played" &&
      match.home_score != null &&
      match.home_score === match.away_score;

    return draw ? "font-bold" : this.resultClass(match, side);
  }

  /** Reason of a default win, for the tooltip of its tag */
  walkoverHint(match: Match): string {
    return match.walkover_reason ?? "";
  }

  /** Registers a default win: asks which team did not show up */
  walkover(match: Match): void {
    const tournament = this.tournament();

    if (!tournament || !this.editable() || !match.home || !match.away) {
      return;
    }

    this.dialog
      .open<WalkoverDialogComponent, WalkoverDialogData, boolean>(
        WalkoverDialogComponent,
        {
          data: {
            tournamentId: tournament.id,
            matchId: match.id,
            home: {
              registration_id: match.home.registration_id,
              name: match.home.team_name,
            },
            away: {
              registration_id: match.away.registration_id,
              name: match.away.team_name,
            },
            goals: tournament.walkover_goals,
            playoff: false,
            round: this.transloco.translate("matches.matchday", {
              number: match.matchday,
            }),
            group: this.groups().length > 1 ? match.group_name : null,
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
          this.reloadAll();
          this.snackbar.notifySuccess("matches.walkover.saved");
        }
      });
  }
}
