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
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { SnackbarService } from "../../../core/snackbar/snackbar.service";
import { ConfirmDialogService } from "../../../shared/confirm-dialog/confirm-dialog.service";
import { LeagueRequiredComponent } from "../../../shared/league-required/league-required.component";
import { listState } from "../../../shared/list-state/list-state";
import { TournamentFormDialogComponent } from "../tournament-form-dialog/tournament-form-dialog.component";
import { TournamentStatusChipComponent } from "../tournament-status-chip/tournament-status-chip.component";
import {
  TOURNAMENT_GENDERS,
  TOURNAMENT_STATUSES,
  parseDate,
  Tournament,
  TournamentsFilters,
} from "../tournament.model";
import { TournamentsApi } from "../tournaments.api";

const START_DATE_FORMAT = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

@Component({
  selector: "app-tournaments-list",
  templateUrl: "./tournaments-list.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "app-page-fill" },
  imports: [
    AppBreadcrumbsComponent,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
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
    TournamentStatusChipComponent,
    TranslocoPipe,
  ],
})
export class TournamentsListComponent {
  private readonly api = inject(TournamentsApi);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  protected readonly leagueContext = inject(LeagueContextService);

  readonly columns = [
    "name",
    "gender",
    "age",
    "start_date",
    "status",
    "actions",
  ];
  readonly genders = TOURNAMENT_GENDERS;
  readonly statuses = TOURNAMENT_STATUSES;

  // Filters (Signal Forms). The search box waits 300 ms before it reaches the model.
  readonly filters = signal<TournamentsFilters>({
    search: "",
    gender: "",
    status: "",
  });
  readonly filtersForm = form(this.filters, (filter) => {
    debounce(filter.search, 300);
  });

  private readonly list = listState({
    filters: this.filters,
    defaultSort: { active: "created_at", direction: "desc" },
    // Another league has other tournaments: start again from the first page
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

  readonly crumbs = computed(() => [
    this.transloco.translate("nav.tournaments"),
  ]);

  /** `Y-m-d` as dd/mm/yyyy (es-MX) */
  startDate(tournament: Tournament): string {
    return START_DATE_FORMAT.format(parseDate(tournament.start_date));
  }

  /** "18 – 35", "Desde 25", "Hasta 40" or "Sin límite" */
  ageRange(tournament: Tournament): string {
    const { min_age: min, max_age: max } = tournament;

    if (min !== null && max !== null) {
      return `${min} – ${max}`;
    }

    if (min !== null) {
      return this.transloco.translate("tournaments.age.from", { min });
    }

    if (max !== null) {
      return this.transloco.translate("tournaments.age.to", { max });
    }

    return this.transloco.translate("tournaments.age.none");
  }

  openForm(tournament?: Tournament): void {
    this.dialog
      .open<TournamentFormDialogComponent, Tournament | null, Tournament>(
        TournamentFormDialogComponent,
        { data: tournament ?? null, width: "560px", maxWidth: "95vw" },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.resource.reload();
          this.snackbar.notifySuccess(
            tournament ? "tournaments.updated" : "tournaments.created",
          );
        }
      });
  }

  /** Starts a planned tournament or finishes one in progress; neither can be undone */
  advance(tournament: Tournament): void {
    const starting = tournament.status === "planning";

    this.confirmDialog
      .confirm({
        key: starting ? "tournaments.start" : "tournaments.finish",
        params: { name: tournament.name },
        tone: starting ? "primary" : "danger",
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.run(
            this.api.setStatus(
              tournament.id,
              starting ? "in_progress" : "finished",
            ),
            starting ? "tournaments.started" : "tournaments.finished",
          );
        }
      });
  }

  remove(tournament: Tournament): void {
    this.confirmDialog
      .confirm({
        key: "tournaments.delete",
        params: { name: tournament.name },
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.run(this.api.remove(tournament.id), "tournaments.deleted");
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
