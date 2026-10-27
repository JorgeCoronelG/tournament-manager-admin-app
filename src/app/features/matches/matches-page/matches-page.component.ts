import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
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
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { LeagueRequiredComponent } from "../../../shared/league-required/league-required.component";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { TournamentStatusChipComponent } from "../../tournaments/tournament-status-chip/tournament-status-chip.component";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import {
  GenerateMatchesDialogComponent,
  GenerateMatchesDialogData,
} from "../generate-matches-dialog/generate-matches-dialog.component";
import {
  AssignScheduleDialogComponent,
  AssignScheduleDialogData,
} from "../assign-schedule-dialog/assign-schedule-dialog.component";
import { ScheduleApi } from "../schedule.api";
import { ScheduleConfigApi } from "../schedule-config.api";
import { datesRange, slotLabel } from "../schedule.model";
import {
  ScheduleConfigDialogComponent,
  ScheduleConfigDialogData,
} from "../schedule-config-dialog/schedule-config-dialog.component";
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
import { GroupsApi } from "../../groups/groups.api";
import { StandingsViewComponent } from "../standings-view/standings-view.component";
import { StandingsApi } from "../standings.api";

/** Up to this many matchdays every section starts open; with more, only the first */
const OPEN_ALL_UP_TO = 4;

/** The regular-phase calendar of a tournament: who plays whom each matchday */
@Component({
  selector: "app-matches-page",
  templateUrl: "./matches-page.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
    StandingsViewComponent,
    TournamentStatusChipComponent,
    TranslocoPipe,
  ],
})
export class MatchesPageComponent {
  private readonly api = inject(MatchesApi);
  private readonly standingsApi = inject(StandingsApi);
  private readonly playoffsApi = inject(PlayoffsApi);
  private readonly groupsApi = inject(GroupsApi);
  private readonly scheduleApi = inject(ScheduleApi);
  private readonly configApi = inject(ScheduleConfigApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  protected readonly leagueContext = inject(LeagueContextService);

  protected readonly tournamentsResource = inject(TournamentsApi).options();
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
      this.selectedSection.set(2);
      this.showBracketNext.set(false);
    }
  });

  /** Hours and fields are configured only while the tournament is in progress (not in planning, nor from the playoffs on) */
  readonly configurable = computed(
    () => this.tournament()?.status === "in_progress",
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

  /** Hours can be assigned once the calendar of pairings exists */
  readonly assignable = computed(() => this.editable() && this.generated());

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
  readonly standingsResource = this.standingsApi.standings(
    computed(() => (this.started() ? this.tournament()?.id : undefined)),
  );
  readonly standings = computed(() =>
    this.standingsResource.hasValue()
      ? this.standingsResource.value().groups
      : [],
  );

  /** The calendar and the tables change together: a result moves both */
  private reloadAll(): void {
    this.resource.reload();
    this.standingsResource.reload();
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

  /** The section tab: the calendar or the standings table */
  readonly selectedSection = signal(0);

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

  /** Short calendars open every section; long ones only the first */
  isOpen(group: GroupSchedule, matchday: number): boolean {
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

  /** "02/11 - 08/11" when the matchday has dated matches */
  rangeOf(matches: Match[]): string | null {
    return datesRange(matches);
  }

  /** The assigned slots changed: the calendar and the outdated notice are asked again */
  private reloadSchedule(): void {
    this.resource.reload();
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
          data: { tournamentId: tournament.id },
          width: "960px",
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

  clearSchedule(): void {
    const tournament = this.tournament();

    if (!tournament || !this.assignable()) {
      return;
    }

    this.confirmDialog
      .confirm({ key: "matches.clearSchedule" })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.scheduleApi.clear(tournament.id).subscribe({
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
          },
          width: "960px",
          maxWidth: "95vw",
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
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
      .confirm({ key: "matches.delete", params: { name: tournament.name } })
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
          },
          width: "720px",
          maxWidth: "95vw",
        },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result === "standings") {
          this.selectedSection.set(1);
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
}
