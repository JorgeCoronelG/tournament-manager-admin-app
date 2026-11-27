import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  linkedSignal,
  viewChild,
} from "@angular/core";
import { Clipboard } from "@angular/cdk/clipboard";
import { Observable } from "rxjs";
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
import { AppAvatarComponent } from "@ui/components/app-avatar/app-avatar.component";
import { AppDateFormatRelativePipe } from "@ui/pipes/app-date-format-relative/app-date-format-relative.pipe";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { LeagueRequiredComponent } from "../../../shared/league-required/league-required.component";
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
import {
  AddRefereeDialogComponent,
  AddRefereeResult,
} from "../add-referee-dialog/add-referee-dialog.component";
import { RefereeEditDialogComponent } from "../referee-edit-dialog/referee-edit-dialog.component";
import { RefereeStatusChipComponent } from "../referee-status-chip/referee-status-chip.component";
import {
  REFEREE_LEAGUE_STATUSES,
  Referee,
  RefereesFilters,
} from "../referee.model";
import { RefereesApi } from "../referees.api";

@Component({
  selector: "app-referees-list",
  templateUrl: "./referees-list.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "app-page-fill" },
  imports: [
    AppAvatarComponent,
    AppBreadcrumbsComponent,
    AppDateFormatRelativePipe,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
    FiltersPanelComponent,
    FiltersToggleComponent,
    FormField,
    LeagueRequiredComponent,
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
    RefereeStatusChipComponent,
    RowActionsComponent,
    TranslocoPipe,
    UserStatusChipComponent,
  ],
})
export class RefereesListComponent {
  private readonly api = inject(RefereesApi);
  private readonly clipboard = inject(Clipboard);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  protected readonly leagueContext = inject(LeagueContextService);

  readonly isMobile = injectIsMobile();

  private readonly dataColumns = [
    "first_name",
    "user_code",
    "email",
    "phone",
    "account_status",
    "status",
    "created_at",
  ];

  /** Desktop: icon buttons in a sticky last column. Phones: a "⋮" menu as the first one. */
  readonly columns = computed(() =>
    this.isMobile()
      ? ["actionsMenu", ...this.dataColumns]
      : [...this.dataColumns, "actions"],
  );
  readonly statuses = REFEREE_LEAGUE_STATUSES;

  // Filters (Signal Forms). The search box waits 300 ms before it reaches the model.
  /** Another league starts again with empty filters, as when the screen is opened */
  readonly filters = linkedSignal<number | null, RefereesFilters>({
    source: this.leagueContext.activeLeagueId,
    computation: () => ({ search: "", status: "" }),
  });
  readonly filtersForm = form(this.filters, (filter) => {
    debounce(filter.search, 300);
  });

  private readonly list = listState({
    filters: this.filters,
    defaultSort: { active: "created_at", direction: "desc" },
    // Another league has other referees: start again from the first page
    resetOn: this.leagueContext.activeLeagueId,
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
  private readonly mobile = mobileList({
    filters: this.filters,
    activeKeys: ["status"],
    changePage: this.list.changePage,
    tableCard: this.tableCard,
  });
  readonly filtersOpen = this.mobile.filtersOpen;
  readonly activeFilters = this.mobile.activeFilters;
  readonly clearFilters = this.mobile.clearFilters;
  readonly changePage = this.mobile.changePage;

  readonly crumbs = computed(() => [this.transloco.translate("nav.referees")]);

  constructor() {
    // Another league starts again with empty filters (see `filters`): fold the panel too
    effect(() => {
      this.leagueContext.activeLeagueId();
      this.filtersOpen.set(false);
    });
  }

  /** The row's actions for the phone menu: the same as the desktop buttons */
  rowActions(referee: Referee): RowAction[] {
    const active = referee.status === "active";

    return [
      // Only a pending account can still be edited or re-invited
      ...(referee.account_status === "pending"
        ? [
            {
              icon: "mat:edit",
              labelKey: "referees.actions.edit",
              run: () => this.openEdit(referee),
            },
            {
              icon: "mat:forward_to_inbox",
              labelKey: "referees.actions.resendInvitation",
              run: () => this.resendInvitation(referee),
            },
          ]
        : []),
      {
        icon: active ? "mat:toggle_on" : "mat:toggle_off",
        labelKey: active
          ? "referees.actions.deactivate"
          : "referees.actions.activate",
        run: () => this.toggleStatus(referee),
      },
      {
        icon: "mat:person_remove",
        labelKey: "referees.actions.remove",
        run: () => this.remove(referee),
        danger: true,
      },
    ];
  }

  openAdd(): void {
    this.dialog
      .open<AddRefereeDialogComponent, undefined, AddRefereeResult>(
        AddRefereeDialogComponent,
        { width: "560px", maxWidth: "95vw" },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.resource.reload();
          this.snackbar.notifySuccess(
            result === "created" ? "referees.created" : "referees.attached",
          );
        }
      });
  }

  openEdit(referee: Referee): void {
    this.dialog
      .open<RefereeEditDialogComponent, Referee, Referee>(
        RefereeEditDialogComponent,
        {
          data: referee,
          width: "560px",
          maxWidth: "95vw",
          // Focus the dialog, not the first field, so nothing is typed by mistake
          autoFocus: "dialog",
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.resource.reload();
          this.snackbar.notifySuccess("referees.updated");
        }
      });
  }

  copyCode(referee: Referee): void {
    if (this.clipboard.copy(referee.user_code)) {
      this.snackbar.notifySuccess("referees.codeCopied");
    }
  }

  /** Deactivates or reactivates them in this league */
  toggleStatus(referee: Referee): void {
    if (referee.status !== "active") {
      this.run(this.api.setStatus(referee.id, "active"), "referees.activated");

      return;
    }

    this.confirmDialog
      .confirm({
        key: "referees.deactivate",
        params: { name: `${referee.first_name} ${referee.last_name}` },
        tone: "primary",
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.run(
            this.api.setStatus(referee.id, "inactive"),
            "referees.deactivated",
          );
        }
      });
  }

  resendInvitation(referee: Referee): void {
    this.run(this.api.resendInvitation(referee.id), "referees.invitationSent");
  }

  remove(referee: Referee): void {
    this.confirmDialog
      .confirm({
        key: "referees.remove",
        params: { name: `${referee.first_name} ${referee.last_name}` },
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.run(this.api.remove(referee.id), "referees.removed");
        }
      });
  }

  private run(request: Observable<unknown>, successKey: string): void {
    request.subscribe({
      next: () => {
        this.resource.reload();
        this.snackbar.notifySuccess(successKey);
      },
      error: (error: unknown) => this.snackbar.notifyFailure(error),
    });
  }
}
