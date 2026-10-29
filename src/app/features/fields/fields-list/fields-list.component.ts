import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
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
import { FieldFormDialogComponent } from "../field-form-dialog/field-form-dialog.component";
import { FieldStatusChipComponent } from "../field-status-chip/field-status-chip.component";
import { Field, FIELD_STATUSES, FieldsFilters } from "../field.model";
import { FieldsApi } from "../fields.api";

@Component({
  selector: "app-fields-list",
  templateUrl: "./fields-list.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "app-page-fill" },
  imports: [
    AppBreadcrumbsComponent,
    AppDateFormatRelativePipe,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
    FieldStatusChipComponent,
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
    TranslocoPipe,
  ],
})
export class FieldsListComponent {
  private readonly api = inject(FieldsApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  protected readonly leagueContext = inject(LeagueContextService);

  readonly columns = ["name", "status", "created_at", "actions"];
  readonly statuses = FIELD_STATUSES;

  // Filters (Signal Forms). The search box waits 300 ms before it reaches the model.
  /** Another league starts again with empty filters, as when the screen is opened */
  readonly filters = linkedSignal<number | null, FieldsFilters>({
    source: this.leagueContext.activeLeagueId,
    computation: () => ({ search: "", status: "" }),
  });
  readonly filtersForm = form(this.filters, (filter) => {
    debounce(filter.search, 300);
  });

  private readonly list = listState({
    filters: this.filters,
    defaultSort: { active: "created_at", direction: "desc" },
    // Another league has other fields: start again from the first page
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

  readonly crumbs = computed(() => [this.transloco.translate("nav.fields")]);

  openForm(field?: Field): void {
    this.dialog
      .open<FieldFormDialogComponent, Field | undefined, Field>(
        FieldFormDialogComponent,
        {
          data: field ?? null,
          width: "480px",
          maxWidth: "95vw",
          // Creating focuses the first field; editing focuses the dialog, so nothing is typed by mistake
          autoFocus: field ? "dialog" : "first-tabbable",
        },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.resource.reload();
          this.snackbar.notifySuccess(
            field ? "fields.updated" : "fields.created",
          );
        }
      });
  }

  /** Deactivating asks first; activating does not */
  toggleStatus(field: Field): void {
    if (field.status === "inactive") {
      this.run(this.api.setStatus(field.id, "active"), "fields.activated");

      return;
    }

    this.confirmDialog
      .confirm({
        key: "fields.deactivate",
        params: { name: field.name },
        tone: "primary",
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.run(
            this.api.setStatus(field.id, "inactive"),
            "fields.deactivated",
          );
        }
      });
  }

  remove(field: Field): void {
    this.confirmDialog
      .confirm({ key: "fields.delete", params: { name: field.name } })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.run(this.api.remove(field.id), "fields.deleted");
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
