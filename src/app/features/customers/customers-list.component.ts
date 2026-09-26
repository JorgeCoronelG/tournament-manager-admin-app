import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatSortModule, Sort } from "@angular/material/sort";
import { MatTableModule } from "@angular/material/table";
import { debounce, form, FormField } from "@angular/forms/signals";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { AppDateFormatRelativePipe } from "@ui/pipes/app-date-format-relative/app-date-format-relative.pipe";
import { CustomerFormDialogComponent } from "./customer-form-dialog.component";
import { CustomerStatusChipComponent } from "./customer-status-chip.component";
import { Customer, CustomersQuery } from "./customer.model";
import { CustomersApi } from "./customers.api";

@Component({
  selector: "app-customers-list",
  templateUrl: "./customers-list.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppBreadcrumbsComponent,
    AppDateFormatRelativePipe,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
    CustomerStatusChipComponent,
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
    RouterLink,
    TranslocoPipe,
  ],
})
export class CustomersListComponent {
  private readonly api = inject(CustomersApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  readonly columns = [
    "name",
    "email",
    "company",
    "country",
    "status",
    "createdAt",
  ];

  // Filters (Signal Forms). The search box waits 300 ms before it reaches the model.
  readonly filters = signal<Pick<CustomersQuery, "search" | "status">>({
    search: "",
    status: "",
  });
  readonly filtersForm = form(this.filters, (filter) => {
    debounce(filter.search, 300);
  });

  private readonly sortState = signal<Sort>({
    active: "name",
    direction: "asc",
  });

  // Changing a filter sends the user back to the first page
  readonly paging = linkedSignal<
    Pick<CustomersQuery, "search" | "status">,
    Pick<CustomersQuery, "page" | "pageSize">
  >({
    source: this.filters,
    computation: (_, previous) => ({
      page: 0,
      pageSize: previous?.value.pageSize ?? 10,
    }),
  });

  private readonly query = computed<CustomersQuery>(() => ({
    ...this.paging(),
    ...this.filters(),
    sort: (this.sortState().active || "name") as keyof Customer,
    order: this.sortState().direction || "asc",
  }));

  private readonly list = this.api.list(this.query);
  readonly resource = this.list.resource;
  readonly total = this.list.total;

  // Keep showing the previous rows while the next page is loading
  readonly rows = linkedSignal<Customer[] | undefined, Customer[]>({
    source: this.resource.value,
    computation: (value, previous) => value ?? previous?.value ?? [],
  });

  readonly crumbs = computed(() => [this.transloco.translate("nav.customers")]);

  sort(sort: Sort): void {
    this.sortState.set(sort);
    this.paging.update((paging) => ({ ...paging, page: 0 }));
  }

  changePage(event: { pageIndex: number; pageSize: number }): void {
    this.paging.set({ page: event.pageIndex, pageSize: event.pageSize });
  }

  openForm(): void {
    this.dialog
      .open<CustomerFormDialogComponent, void, Customer>(
        CustomerFormDialogComponent,
      )
      .afterClosed()
      .subscribe((created) => {
        if (created) {
          this.resource.reload();
          this.snackBar.open(
            this.transloco.translate("customers.created"),
            this.transloco.translate("common.ok"),
            { duration: 4000 },
          );
        }
      });
  }
}
