import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
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
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { listState } from "../../../shared/list-state/list-state";
import { UserFormDialogComponent } from "../user-form-dialog/user-form-dialog.component";
import { UserStatusChipComponent } from "../user-status-chip/user-status-chip.component";
import { User, UsersFilters } from "../user.model";
import { UsersApi } from "../users.api";

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
  readonly filters = signal<UsersFilters>({
    search: "",
    roleId: "",
    status: "",
  });
  readonly filtersForm = form(this.filters, (filter) => {
    debounce(filter.search, 300);
  });

  private readonly list = listState({
    filters: this.filters,
    defaultSort: { active: "created_at", direction: "desc" },
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

  readonly crumbs = computed(() => [this.transloco.translate("nav.users")]);

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
