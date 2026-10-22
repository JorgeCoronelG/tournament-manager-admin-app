import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";
import { debounce, form, FormField } from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { AppDateFormatRelativePipe } from "@ui/pipes/app-date-format-relative/app-date-format-relative.pipe";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { LeagueRequiredComponent } from "../../../shared/league-required/league-required.component";
import { listState } from "../../../shared/list-state/list-state";
import { LogoImageComponent } from "../../../shared/logo-image/logo-image.component";
import { isBanned, Registration } from "../../registrations/registration.model";
import { RegistrationsApi } from "../../registrations/registrations.api";
import { TournamentStatusChipComponent } from "../../tournaments/tournament-status-chip/tournament-status-chip.component";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import {
  RosterRemoveDialogComponent,
  RosterRemoveDialogData,
} from "../roster-remove-dialog/roster-remove-dialog.component";
import { RosterStatusChipComponent } from "../roster-status-chip/roster-status-chip.component";
import {
  playerName,
  ROSTER_STATUSES,
  RosterEntry,
  RosterFilters,
} from "../roster.model";
import { RostersApi } from "../rosters.api";

@Component({
  selector: "app-rosters-page",
  templateUrl: "./rosters-page.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "app-page-fill" },
  imports: [
    AppBreadcrumbsComponent,
    AppDateFormatRelativePipe,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
    FormField,
    LeagueRequiredComponent,
    LogoImageComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    RosterStatusChipComponent,
    TournamentStatusChipComponent,
    TranslocoPipe,
  ],
})
export class RostersPageComponent {
  private readonly api = inject(RostersApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  protected readonly leagueContext = inject(LeagueContextService);

  readonly columns = [
    "photo",
    "player",
    "jersey",
    "status",
    "request",
    "actions",
  ];
  readonly statuses = ROSTER_STATUSES;

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
  private readonly tournamentId = computed(() => this.tournament()?.id);

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

  /** Teams with an active enrollment in the tournament */
  protected readonly teamsResource = inject(RegistrationsApi).all(
    this.tournamentId,
  );
  readonly teams = computed(() =>
    this.tournamentId() !== undefined && this.teamsResource.hasValue()
      ? this.teamsResource
          .value()
          .data.filter((registration) => registration.status === "active")
      : [],
  );

  /** The team picker; it empties whenever the tournament changes */
  readonly teamPicker = linkedSignal<number | undefined, { team: number | "" }>(
    {
      source: this.tournamentId,
      computation: () => ({ team: "" }),
    },
  );
  readonly teamPickerForm = form(this.teamPicker);

  readonly registration = computed(() => {
    const id = this.teamPicker().team;

    return this.teams().find((item) => item.id === id);
  });
  private readonly registrationId = computed(() => this.registration()?.id);

  readonly filters = signal<RosterFilters>({ search: "", status: "" });
  readonly filtersForm = form(this.filters, (filter) => {
    debounce(filter.search, 300);
  });

  private readonly list = listState({
    filters: this.filters,
    defaultSort: { active: "", direction: "" },
    resetOn: this.registrationId,
    load: (query) =>
      this.api.list(this.tournamentId, this.registrationId, query),
  });

  protected readonly rosterResource = this.list.resource;
  readonly rows = this.list.rows;
  readonly total = this.list.total;
  readonly paging = this.list.paging;
  readonly hasFilters = this.list.hasFilters;
  readonly changePage = this.list.changePage;

  /** Active and pending players against the tournament's maximum, if it has one */
  readonly counter = computed(() => {
    const summary = this.rosterResource.value()?.summary;

    return summary
      ? {
          count: (summary["active"] ?? 0) + (summary["pending"] ?? 0),
          max: summary["max_roster_size"] ?? null,
        }
      : undefined;
  });

  readonly banned = computed(() => {
    const registration = this.registration();

    return registration !== undefined && isBanned(registration.team);
  });

  /** Why a player cannot be removed (translation key), or null when they can */
  readonly removeBlocked = computed(() => {
    const tournament = this.tournament();

    if (tournament?.status === "finished") {
      return "rosters.finishedHint";
    }

    return tournament?.playoffs_started ? "rosters.playoffsHint" : null;
  });
  readonly canRemove = computed(() => this.removeBlocked() === null);

  readonly crumbs = computed(() => [
    this.transloco.translate("nav.tournaments"),
    this.transloco.translate("nav.rosters"),
  ]);

  /** Teams can share a name, so the option shows the delegate too */
  teamLabel(registration: Registration): string {
    const { team } = registration;

    return team.manager
      ? this.transloco.translate("teams.withManager", {
          name: team.name,
          manager: team.manager.name,
        })
      : team.name;
  }

  protected readonly playerName = playerName;

  remove(entry: RosterEntry): void {
    const tournament = this.tournament();
    const registration = this.registration();

    if (!tournament || !registration || !this.canRemove()) {
      return;
    }

    const data: RosterRemoveDialogData = {
      tournamentId: tournament.id,
      registrationId: registration.id,
      rosterId: entry.id,
      player: playerName(entry.player),
      team: registration.team.name,
    };

    this.dialog
      .open<RosterRemoveDialogComponent, RosterRemoveDialogData, boolean>(
        RosterRemoveDialogComponent,
        { data, width: "480px", maxWidth: "95vw" },
      )
      .afterClosed()
      .subscribe((removed) => {
        if (removed) {
          this.rosterResource.reload();
          this.snackbar.notifySuccess("rosters.removed");
        }
      });
  }

  toggleRejoin(entry: RosterEntry): void {
    const tournament = this.tournament();
    const registration = this.registration();

    if (!tournament || !registration) {
      return;
    }

    const revoke = entry.rejoin_authorized_at !== null;
    const done = () => {
      this.rosterResource.reload();
      this.snackbar.notifySuccess(
        revoke ? "rosters.rejoinRevoked" : "rosters.rejoinAuthorized",
      );
    };
    const request = () =>
      (revoke
        ? this.api.revokeRejoin(tournament.id, registration.id, entry.id)
        : this.api.authorizeRejoin(tournament.id, registration.id, entry.id)
      ).subscribe({
        next: done,
        error: (error: unknown) => this.snackbar.notifyFailure(error),
      });

    if (revoke) {
      request();

      return;
    }

    this.confirmDialog
      .confirm({
        key: "rosters.rejoin",
        params: { player: playerName(entry.player) },
        tone: "primary",
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          request();
        }
      });
  }
}
