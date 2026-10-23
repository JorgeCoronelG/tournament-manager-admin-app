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
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatSortModule } from "@angular/material/sort";
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
import { GroupsApi } from "../../groups/groups.api";
import { TournamentStatusChipComponent } from "../../tournaments/tournament-status-chip/tournament-status-chip.component";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import { UserStatusChipComponent } from "../../users/user-status-chip/user-status-chip.component";
import {
  RegistrationDialogComponent,
  RegistrationDialogData,
} from "../registration-dialog/registration-dialog.component";
import { isBanned, Registration } from "../registration.model";
import { RegistrationsApi } from "../registrations.api";

@Component({
  selector: "app-registrations-page",
  templateUrl: "./registrations-page.component.html",
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
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    TournamentStatusChipComponent,
    TranslocoPipe,
    UserStatusChipComponent,
  ],
})
export class RegistrationsPageComponent {
  private readonly api = inject(RegistrationsApi);
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
  private readonly tournamentId = computed(() => this.tournament()?.id);

  /** Only a tournament in planning takes or loses teams */
  readonly editable = computed(() => this.tournament()?.status === "planning");

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

  private readonly groups = inject(GroupsApi).view(this.tournamentId);

  /** Registration id to the name of its group, only with more than one regular group */
  private readonly groupNames = computed(() => {
    const regular = this.groups.value()?.regular ?? [];

    return regular.length > 1
      ? new Map(
          regular.flatMap((group) =>
            group.teams.map((team) => [team.id, group.name] as const),
          ),
        )
      : null;
  });

  /** The Group column only makes sense when the tournament has several regular groups */
  readonly columns = computed(() => [
    "logo",
    "team",
    ...(this.groupNames() ? ["group"] : []),
    "manager",
    "created_at",
    "actions",
  ]);

  /** Name of the registration's group; null when it has none */
  groupName(registration: Registration): string | null {
    return this.groupNames()?.get(registration.id) ?? null;
  }

  readonly filters = signal({ search: "" });
  readonly filtersForm = form(this.filters, (filter) => {
    debounce(filter.search, 300);
  });

  private readonly list = listState({
    filters: this.filters,
    defaultSort: { active: "created_at", direction: "desc" },
    resetOn: this.tournamentId,
    load: (query) => this.api.list(this.tournamentId, query),
  });

  readonly paging = this.list.paging;
  readonly resource = this.list.resource;
  readonly rows = this.list.rows;
  readonly total = this.list.total;
  readonly hasFilters = this.list.hasFilters;
  readonly changePage = this.list.changePage;

  /** Totals of the whole tournament, whatever the search or the page */
  private readonly summary = computed(() => this.resource.value()?.summary);
  readonly registeredCount = computed(
    () => this.summary()?.["registered"] ?? this.total(),
  );
  readonly bannedCount = computed(() => this.summary()?.["banned"] ?? 0);
  protected readonly isBanned = isBanned;

  readonly crumbs = computed(() => [
    this.transloco.translate("nav.tournaments"),
    this.transloco.translate("nav.registrations"),
  ]);

  register(): void {
    const tournament = this.tournament();

    if (!tournament || !this.editable()) {
      return;
    }

    this.dialog
      .open<RegistrationDialogComponent, RegistrationDialogData, boolean>(
        RegistrationDialogComponent,
        {
          data: { tournamentId: tournament.id },
          width: "560px",
          maxWidth: "95vw",
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.resource.reload();
          this.snackbar.notifySuccess("registrations.registered");
        }
      });
  }

  /** The confirmation names the delegate too: teams can share a name */
  remove(registration: Registration): void {
    const tournament = this.tournament();

    if (!tournament || !this.editable()) {
      return;
    }

    const { team } = registration;
    const name = team.manager
      ? this.transloco.translate("teams.withManager", {
          name: team.name,
          manager: team.manager.name,
        })
      : this.transloco.translate("teams.withoutManager", { name: team.name });

    this.confirmDialog
      .confirm({ key: "registrations.remove", params: { name } })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.api.remove(tournament.id, registration.id).subscribe({
          next: () => {
            this.resource.reload();
            this.snackbar.notifySuccess("registrations.removed");
          },
          error: (error: unknown) => this.snackbar.notifyFailure(error),
        });
      });
  }
}
