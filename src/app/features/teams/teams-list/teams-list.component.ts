import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
} from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
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
import { Observable } from "rxjs";
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
import { UserStatusChipComponent } from "../../users/user-status-chip/user-status-chip.component";
import {
  TeamFormDialogComponent,
  TeamFormResult,
} from "../team-form-dialog/team-form-dialog.component";
import { TeamManagerDialogComponent } from "../team-manager-dialog/team-manager-dialog.component";
import { TeamManagerEditDialogComponent } from "../team-manager-edit-dialog/team-manager-edit-dialog.component";
import { TeamStatusChipComponent } from "../team-status-chip/team-status-chip.component";
import { Team, TEAM_STATUSES, TeamsFilters } from "../team.model";
import { TeamsApi } from "../teams.api";

@Component({
  selector: "app-teams-list",
  templateUrl: "./teams-list.component.html",
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
    NgTemplateOutlet,
    TeamStatusChipComponent,
    TranslocoPipe,
    UserStatusChipComponent,
  ],
})
export class TeamsListComponent {
  private readonly api = inject(TeamsApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  protected readonly leagueContext = inject(LeagueContextService);

  readonly columns = [
    "logo",
    "name",
    "manager",
    "status",
    "created_at",
    "actions",
  ];
  readonly statuses = TEAM_STATUSES;

  // Filters (Signal Forms). The search box waits 300 ms before it reaches the model.
  /** Another league starts again with empty filters, as when the screen is opened */
  readonly filters = linkedSignal<number | null, TeamsFilters>({
    source: this.leagueContext.activeLeagueId,
    computation: () => ({
      search: "",
      status: "",
      manager: "",
    }),
  });
  readonly filtersForm = form(this.filters, (filter) => {
    debounce(filter.search, 300);
  });

  private readonly list = listState({
    filters: this.filters,
    defaultSort: { active: "created_at", direction: "desc" },
    // Another league has other teams: start again from the first page
    resetOn: this.leagueContext.activeLeagueId,
    load: (query) => this.api.list(query),
  });

  readonly sortState = this.list.sortState;
  readonly paging = this.list.paging;
  readonly resource = this.list.resource;
  readonly rows = this.list.rows;
  readonly total = this.list.total;
  readonly hasFilters = this.list.hasFilters;
  readonly sort = this.list.sort;
  readonly changePage = this.list.changePage;

  /** The delegates of this league's teams, for the delegate filter */
  private readonly managersResource = this.api.managers();
  readonly managers = computed(() =>
    this.managersResource.hasValue() ? this.managersResource.value() : [],
  );

  // A delegate that no longer has teams leaves the options: drop its filter
  private readonly dropGoneManager = effect(() => {
    const manager = this.filters().manager;

    if (
      typeof manager === "number" &&
      this.managersResource.hasValue() &&
      !this.managers().some((option) => option.id === manager)
    ) {
      this.filters.update((filters) => ({ ...filters, manager: "" }));
    }
  });

  readonly crumbs = computed(() => [this.transloco.translate("nav.teams")]);

  openForm(team?: Team): void {
    this.dialog
      .open<TeamFormDialogComponent, Team | null, TeamFormResult>(
        TeamFormDialogComponent,
        { data: team ?? null, width: "560px", maxWidth: "95vw" },
      )
      .afterClosed()
      .subscribe((result) => {
        if (!result) {
          return;
        }

        this.reloadAll();

        if (result.logoFailed) {
          this.snackbar.warning(this.transloco.translate("teams.logoFailed"));
        } else {
          this.snackbar.notifySuccess(team ? "teams.updated" : "teams.created");
        }
      });
  }

  openManager(team: Team): void {
    this.dialog
      .open<TeamManagerDialogComponent, Team, Team>(
        TeamManagerDialogComponent,
        { data: team, width: "560px", maxWidth: "95vw" },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reloadAll();
          this.snackbar.notifySuccess("teams.managerSaved");
        }
      });
  }

  openManagerEdit(team: Team): void {
    this.dialog
      .open<TeamManagerEditDialogComponent, Team, Team>(
        TeamManagerEditDialogComponent,
        { data: team, width: "560px", maxWidth: "95vw" },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reloadAll();
          this.snackbar.notifySuccess("teams.managerUpdated");
        }
      });
  }

  removeManager(team: Team): void {
    this.confirmDialog
      .confirm({
        key: "teams.removeManager",
        params: {
          name: `${team.manager?.first_name} ${team.manager?.last_name}`,
          team: team.name,
        },
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.run(this.api.removeManager(team.id), "teams.managerRemoved");
        }
      });
  }

  resendInvitation(team: Team): void {
    this.run(this.api.resendInvitation(team.id), "teams.invitationSent");
  }

  /** Banning asks first; reactivating does not */
  toggleStatus(team: Team): void {
    if (team.status === "banned") {
      this.run(this.api.setStatus(team.id, "active"), "teams.reactivated");

      return;
    }

    this.confirmDialog
      .confirm({ key: "teams.ban", params: { name: this.teamLabel(team) } })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.run(this.api.setStatus(team.id, "banned"), "teams.banned");
        }
      });
  }

  remove(team: Team): void {
    this.confirmDialog
      .confirm({ key: "teams.delete", params: { name: this.teamLabel(team) } })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.run(this.api.remove(team.id), "teams.deleted");
        }
      });
  }

  /**
   * Teams can share a name: the confirmations name the delegate too
   * ("Halcones (delegado: Luis Pérez)", "Halcones (sin delegado)").
   */
  private teamLabel(team: Team): string {
    return team.manager
      ? this.transloco.translate("teams.withManager", {
          name: team.name,
          manager: `${team.manager.first_name} ${team.manager.last_name}`,
        })
      : this.transloco.translate("teams.withoutManager", { name: team.name });
  }

  /** The table and the delegate filter (a change can add or drop a delegate) */
  private reloadAll(): void {
    this.resource.reload();
    this.managersResource.reload();
  }

  private run(request: Observable<unknown>, successKey: string): void {
    request.subscribe({
      next: () => {
        this.reloadAll();
        this.snackbar.notifySuccess(successKey);
      },
      error: (error: unknown) => this.snackbar.notifyFailure(error),
    });
  }
}
