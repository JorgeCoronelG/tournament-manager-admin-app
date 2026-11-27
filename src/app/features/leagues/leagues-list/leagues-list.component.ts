import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatProgressBarModule } from "@angular/material/progress-bar";
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
import { listState } from "../../../shared/list-state/list-state";
import { FiltersPanelComponent } from "../../../shared/mobile-filters/filters-panel.component";
import { FiltersToggleComponent } from "../../../shared/mobile-filters/filters-toggle.component";
import { injectIsMobile } from "../../../shared/responsive/is-mobile";
import {
  mobileList,
  mobilePageSize,
} from "../../../shared/responsive/mobile-list";
import {
  RowAction,
  RowActionsComponent,
} from "../../../shared/row-actions/row-actions.component";
import { UserStatusChipComponent } from "../../users/user-status-chip/user-status-chip.component";
import { LeagueAdminSelectComponent } from "../league-admin-select/league-admin-select.component";
import { LeagueFormDialogComponent } from "../league-form-dialog/league-form-dialog.component";
import { League, LeaguesFilters } from "../league.model";
import { LeaguesApi } from "../leagues.api";

@Component({
  selector: "app-leagues-list",
  templateUrl: "./leagues-list.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "app-page-fill" },
  imports: [
    AppBreadcrumbsComponent,
    AppDateFormatRelativePipe,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
    FiltersPanelComponent,
    FiltersToggleComponent,
    FormField,
    LeagueAdminSelectComponent,
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
    RowActionsComponent,
    TranslocoPipe,
    UserStatusChipComponent,
  ],
})
export class LeaguesListComponent {
  private readonly api = inject(LeaguesApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly leagueContext = inject(LeagueContextService);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  readonly isMobile = injectIsMobile();

  private readonly dataColumns = [
    "name",
    "admin",
    "limits",
    "status",
    "created_at",
  ];

  /** Desktop: icon buttons in a sticky last column. Phones: a "⋮" menu as the first one. */
  readonly columns = computed(() =>
    this.isMobile()
      ? ["actionsMenu", ...this.dataColumns]
      : [...this.dataColumns, "actions"],
  );

  // Filters (Signal Forms). The search box waits 300 ms before it reaches the model.
  readonly filters = signal<LeaguesFilters>({
    search: "",
    adminUserId: "",
    status: "",
  });
  readonly filtersForm = form(this.filters, (filter) => {
    debounce(filter.search, 300);
  });

  private readonly list = listState({
    filters: this.filters,
    defaultSort: { active: "created_at", direction: "desc" },
    pageSize: mobilePageSize(this.isMobile()),
    load: (query) => this.api.list(query),
  });

  readonly sortState = this.list.sortState;
  readonly paging = this.list.paging;
  readonly resource = this.list.resource;
  readonly rows = this.list.rows;
  readonly total = this.list.total;
  readonly hasFilters = this.list.hasFilters;
  readonly sort = this.list.sort;

  private readonly tableCard = viewChild<ElementRef<HTMLElement>>("tableCard");

  /** Phones: the folding filters panel, its badge and the page scroll */
  readonly mobile = mobileList({
    filters: this.filters,
    activeKeys: ["adminUserId", "status"],
    changePage: this.list.changePage,
    tableCard: this.tableCard,
  });
  readonly filtersOpen = this.mobile.filtersOpen;
  readonly activeFilters = this.mobile.activeFilters;
  readonly clearFilters = this.mobile.clearFilters;
  readonly changePage = this.mobile.changePage;

  /** "1 torneo", "3 torneos" or "Sin límite" */
  limitsText(league: League): string {
    const max = league.max_active_tournaments;

    return max === null
      ? this.transloco.translate("leagues.limits.none")
      : this.transloco.translate(
          max === 1
            ? "leagues.limits.tournamentsOne"
            : "leagues.limits.tournamentsMany",
          { count: max },
        );
  }

  readonly crumbs = computed(() => [this.transloco.translate("nav.leagues")]);

  /** The row's actions for the phone menu: the same as the desktop buttons */
  rowActions(league: League): RowAction[] {
    return [
      {
        icon: "mat:edit",
        labelKey: "leagues.actions.edit",
        run: () => this.openForm(league),
      },
      {
        icon: league.is_active ? "mat:toggle_on" : "mat:toggle_off",
        labelKey: league.is_active
          ? "leagues.actions.deactivate"
          : "leagues.actions.activate",
        run: () => this.toggleActive(league),
      },
      {
        icon: "mat:delete",
        labelKey: "leagues.actions.delete",
        run: () => this.remove(league),
        danger: true,
      },
    ];
  }

  openForm(league?: League): void {
    this.dialog
      .open<LeagueFormDialogComponent, League | null, League>(
        LeagueFormDialogComponent,
        {
          data: league ?? null,
          width: "560px",
          maxWidth: "95vw",
          // Creating focuses the first field; editing focuses the dialog, so nothing is typed by mistake
          autoFocus: league ? "dialog" : "first-tabbable",
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reloadLists();
          this.snackbar.notifySuccess(
            league ? "leagues.updated" : "leagues.created",
          );
        }
      });
  }

  /** Refreshes the table and the toolbar selector, which loads its own list */
  private reloadLists(): void {
    this.resource.reload();
    this.leagueContext.reload();
  }

  toggleActive(league: League): void {
    this.confirmDialog
      .confirm({
        key: league.is_active ? "leagues.deactivate" : "leagues.activate",
        params: { name: league.name },
        tone: "primary",
        cancelOutlined: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.api.setStatus(league.id, !league.is_active).subscribe({
          next: () => {
            this.reloadLists();
            this.snackbar.notifySuccess(
              league.is_active ? "leagues.deactivated" : "leagues.activated",
            );
          },
          error: (error: unknown) => this.snackbar.notifyFailure(error),
        });
      });
  }

  remove(league: League): void {
    this.confirmDialog
      .confirm({ key: "leagues.delete", params: { name: league.name } })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.api.remove(league.id).subscribe({
          next: () => {
            this.reloadLists();
            this.snackbar.notifySuccess("leagues.deleted");
          },
          error: (error: unknown) => this.snackbar.notifyFailure(error),
        });
      });
  }
}
