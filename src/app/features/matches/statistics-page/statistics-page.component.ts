import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { form, FormField } from "@angular/forms/signals";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatTabsModule } from "@angular/material/tabs";
import { ActivatedRoute } from "@angular/router";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { map } from "rxjs";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { LeagueRequiredComponent } from "../../../shared/league-required/league-required.component";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import { StandingsViewComponent } from "../standings-view/standings-view.component";
import { StandingsApi } from "../standings.api";

/**
 * Statistics of a tournament. Each kind lives in its own tab (for now only the
 * standings; scorers and cards will join them).
 */
@Component({
  selector: "app-statistics-page",
  templateUrl: "./statistics-page.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    StandingsViewComponent,
    TranslocoPipe,
  ],
})
export class StatisticsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly standingsApi = inject(StandingsApi);
  private readonly transloco = inject(TranslocoService);

  protected readonly leagueContext = inject(LeagueContextService);

  protected readonly tournamentsResource = inject(TournamentsApi).options([
    "in_progress",
    "playoffs",
  ]);
  readonly tournaments = computed(() =>
    this.tournamentsResource.hasValue()
      ? this.tournamentsResource.value().data
      : [],
  );

  /** The tournament picker ("" until one is chosen) */
  readonly picker = signal<{ tournament: number | "" }>({ tournament: "" });
  readonly pickerForm = form(this.picker);

  readonly tournament = computed(() => {
    const id = this.picker().tournament;

    return this.tournaments().find((item) => item.id === id);
  });

  /** `?torneo=ID`: the tournament a link (the close-phase dialog's) asks for */
  private readonly requested = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => Number(params.get("torneo")) || null),
    ),
    { initialValue: null },
  );
  private readonly preselect = effect(() => {
    const id = this.requested();

    if (
      id !== null &&
      this.tournaments().some((item) => item.id === id) &&
      untracked(this.picker).tournament === ""
    ) {
      untracked(() => this.picker.set({ tournament: id }));
    }
  });

  // A tournament that is no longer in the league (another league was picked) is dropped
  private readonly dropGoneTournament = effect(() => {
    if (
      this.picker().tournament !== "" &&
      this.tournamentsResource.hasValue() &&
      !this.tournament()
    ) {
      this.picker.set({ tournament: "" });
    }
  });

  /** A tournament in planning has no table to ask for */
  readonly started = computed(() => {
    const status = this.tournament()?.status;

    return status !== undefined && status !== "planning";
  });

  /** Only a tournament in progress lets the order of tied teams be set */
  readonly editable = computed(
    () => this.tournament()?.status === "in_progress",
  );

  readonly standingsResource = this.standingsApi.standings(
    computed(() => (this.started() ? this.tournament()?.id : undefined)),
  );
  readonly standings = computed(() =>
    this.standingsResource.hasValue()
      ? this.standingsResource.value().groups
      : [],
  );

  readonly playoffs = computed(() =>
    this.standingsResource.hasValue()
      ? (this.standingsResource.value().playoffs ?? [])
      : [],
  );

  readonly crumbs = computed(() => [
    this.transloco.translate("nav.tournaments"),
    this.transloco.translate("nav.statistics"),
  ]);
}
