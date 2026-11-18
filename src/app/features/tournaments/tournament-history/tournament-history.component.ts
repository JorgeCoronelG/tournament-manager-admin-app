import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
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
import { debounce, form, FormField } from "@angular/forms/signals";
import { RouterLink } from "@angular/router";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { LeagueRequiredComponent } from "../../../shared/league-required/league-required.component";
import { listState } from "../../../shared/list-state/list-state";
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
    RouterLink,
    TranslocoPipe,
  ],
})
export class TournamentHistoryComponent {
  private readonly api = inject(TournamentsApi);
  private readonly memory = inject(TournamentHistoryMemory);
  private readonly transloco = inject(TranslocoService);

  protected readonly leagueContext = inject(LeagueContextService);

  readonly columns = ["name", "teams_count", "playoffs_count", "actions"];

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
  readonly changePage = this.list.changePage;

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
