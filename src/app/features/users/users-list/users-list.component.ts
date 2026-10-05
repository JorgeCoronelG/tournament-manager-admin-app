import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from "@angular/core";
import { Observable } from "rxjs";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatSortModule, Sort } from "@angular/material/sort";
import { MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";
import { debounce, form, FormField } from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { AppDateFormatRelativePipe } from "@ui/pipes/app-date-format-relative/app-date-format-relative.pipe";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog.service";
import { UserFormDialogComponent } from "../user-form-dialog/user-form-dialog.component";
import { UserStatusChipComponent } from "../user-status-chip/user-status-chip.component";
import { User, UsersQuery } from "../user.model";
import { UsersApi } from "../users.api";

type Filters = Pick<UsersQuery, "search" | "roleId" | "status">;

/** MatSort state to the API's `sort` value (`-` prefix for descending) */
export function toSortParam(sort: Sort): string {
  if (!sort.active || !sort.direction) {
    return "";
  }

  return sort.direction === "desc" ? `-${sort.active}` : sort.active;
}

@Component({
  selector: "app-users-list",
  templateUrl: "./users-list.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "app-page-fill" },
  imports: [
    AppBreadcrumbsComponent,
    AppDateFormatRelativePipe,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
    FormField,
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
    TranslocoPipe,
    UserStatusChipComponent,
  ],
})
export class UsersListComponent {
  private readonly api = inject(UsersApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  readonly columns = [
    "first_name",
    "last_name",
    "email",
    "phone",
    "roles",
    "status",
    "created_at",
    "actions",
  ];

  readonly roles = this.api.roles();

  // Filters (Signal Forms). The search box waits 300 ms before it reaches the model.
  readonly filters = signal<Filters>({ search: "", roleId: "", status: "" });
  readonly filtersForm = form(this.filters, (filter) => {
    debounce(filter.search, 300);
  });

  /** Tells an empty table (no users yet) from one emptied by the filters */
  readonly hasFilters = computed(() => {
    const { search, roleId, status } = this.filters();

    return search !== "" || roleId !== "" || status !== "";
  });

  readonly sortState = signal<Sort>({
    active: "created_at",
    direction: "desc",
  });

  // Changing the search, a filter or the order sends the user back to the first page
  readonly paging = linkedSignal<
    [Filters, Sort],
    Pick<UsersQuery, "page" | "pageSize">
  >({
    source: () => [this.filters(), this.sortState()],
    computation: (_, previous) => ({
      page: 0,
      pageSize: previous?.value.pageSize ?? 5,
    }),
  });

  private readonly query = computed<UsersQuery>(() => ({
    ...this.paging(),
    ...this.filters(),
    sort: toSortParam(this.sortState()),
  }));

  private readonly list = this.api.list(this.query);
  readonly resource = this.list.resource;
  readonly total = this.list.total;

  // Keep showing the previous rows while the next page is loading
  readonly rows = linkedSignal<User[] | undefined, User[]>({
    source: this.list.rows,
    computation: (value, previous) => value ?? previous?.value ?? [],
  });

  readonly crumbs = computed(() => [this.transloco.translate("nav.users")]);

  sort(sort: Sort): void {
    this.sortState.set(sort);
  }

  changePage(event: { pageIndex: number; pageSize: number }): void {
    this.paging.set({ page: event.pageIndex, pageSize: event.pageSize });
  }

  openForm(user?: User): void {
    this.dialog
      .open<UserFormDialogComponent, User | null, User>(
        UserFormDialogComponent,
        {
          data: user ?? null,
          // Same width for create and edit (otherwise it follows the create-only notice)
          width: "560px",
          maxWidth: "95vw",
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.resource.reload();
          this.snackbar.notifySuccess(user ? "users.updated" : "users.created");
        }
      });
  }

  toggleActive(user: User): void {
    this.run(
      this.api.setStatus(user.id, !user.is_active),
      user.is_active ? "users.deactivated" : "users.activated",
    );
  }

  resendInvitation(user: User): void {
    this.run(this.api.resendInvitation(user.id), "users.invitationSent");
  }

  remove(user: User): void {
    this.confirmDialog
      .confirm({
        key: "users.delete",
        params: { name: `${user.first_name} ${user.last_name}` },
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.run(this.api.remove(user.id), "users.deleted");
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
