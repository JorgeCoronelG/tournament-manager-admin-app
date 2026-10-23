import { DatePipe, NgTemplateOutlet } from "@angular/common";
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
    DatePipe,
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

  /** A tournament in planning has no calendar to ask for */
  readonly started = computed(() => {
    const status = this.tournament()?.status;

    return status !== undefined && status !== "planning";
  });

  /** Only a tournament in progress generates, replaces or deletes its calendar */
  readonly editable = computed(
    () => this.tournament()?.status === "in_progress",
  );

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

  restingNames(resting: ReadonlyArray<{ team_name: string }>): string {
    return resting.map((team) => team.team_name).join(", ");
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
