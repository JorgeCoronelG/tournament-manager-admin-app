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
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatTableModule } from "@angular/material/table";
import { MatTooltipModule } from "@angular/material/tooltip";
import { NgTemplateOutlet } from "@angular/common";
import { debounce, form, FormField } from "@angular/forms/signals";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
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
import { TournamentHistoryFilters } from "../tournament.model";
import { TournamentsApi } from "../tournaments.api";
import { TournamentHistoryMemory } from "./tournament-history-memory.service";

/** The league's finished tournaments, with the years that have any as a filter */
@Component({
  selector: "app-tournament-history",
  templateUrl: "./tournament-history.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "app-page-fill" },
  imports: [
    AppBreadcrumbsComponent,
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
    MatTableModule,
    MatTooltipModule,
    NgTemplateOutlet,
    RouterLink,
    RowActionsComponent,
    TranslocoPipe,
  ],
})
export class TournamentHistoryComponent {
  private readonly api = inject(TournamentsApi);
  private readonly memory = inject(TournamentHistoryMemory);
  private readonly transloco = inject(TranslocoService);

  protected readonly leagueContext = inject(LeagueContextService);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isMobile = injectIsMobile();

  private readonly dataColumns = ["name", "teams_count", "playoffs_count"];

  /** Desktop: an icon button in a sticky last column. Phones: a "⋮" menu as the first one. */
  readonly columns = computed(() =>
    this.isMobile()
      ? ["actionsMenu", ...this.dataColumns]
      : [...this.dataColumns, "actions"],
  );

  /** Another league starts again with empty filters, as when the screen is opened */
  readonly filters = linkedSignal<number | null, TournamentHistoryFilters>({
    source: this.leagueContext.activeLeagueId,
    computation: (leagueId) => this.memory.filtersFor(leagueId),
  });
  readonly filtersForm = form(this.filters, (filter) => {
    debounce(filter.search, 300);
  });

  private readonly list = listState({
    filters: this.filters,
    // The backend sends them newest first: no column sorts
    defaultSort: { active: "", direction: "" },
    resetOn: this.leagueContext.activeLeagueId,
    pageSize: mobilePageSize(this.isMobile()),
    // Coming back from a tournament's detail: the page it was left on
    initialPaging: computed(() =>
      this.memory.pagingFor(this.leagueContext.activeLeagueId()),
    ),
    load: (query) => this.api.history(query),
  });

  readonly paging = this.list.paging;
  readonly resource = this.list.resource;
  readonly rows = this.list.rows;
  readonly total = this.list.total;
  readonly hasFilters = this.list.hasFilters;

  private readonly tableCard = viewChild<ElementRef<HTMLElement>>("tableCard");

  /** Phones: the folding filters panel, its badge and the page scroll */
  private readonly mobile = mobileList({
    filters: this.filters,
    activeKeys: ["year"],
    changePage: this.list.changePage,
    tableCard: this.tableCard,
  });
  readonly filtersOpen = this.mobile.filtersOpen;
  readonly activeFilters = this.mobile.activeFilters;
  readonly clearFilters = this.mobile.clearFilters;
  readonly changePage = this.mobile.changePage;

  /** The row's action for the phone menu: the same as the desktop button */
  rowActions(row: { id: number }): RowAction[] {
    return [
      {
        icon: "mat:visibility",
        labelKey: "tournaments.history.view",
        run: () =>
          void this.router.navigate([row.id], { relativeTo: this.route }),
      },
    ];
  }

  // Remembered so the detail's back link returns to this same list
  private readonly remember = effect(() =>
    this.memory.save(
      this.leagueContext.activeLeagueId(),
      this.filters(),
      this.paging(),
    ),
  );

  private readonly yearsResource = this.api.historyYears();

  /** Only the years with finished tournaments, newest first */
  readonly years = computed(() =>
    this.yearsResource.hasValue()
      ? [...this.yearsResource.value().data].sort((a, b) => b - a)
      : [],
  );

  readonly crumbs = computed(() => [
    this.transloco.translate("nav.tournaments"),
    this.transloco.translate("nav.history"),
  ]);
}
