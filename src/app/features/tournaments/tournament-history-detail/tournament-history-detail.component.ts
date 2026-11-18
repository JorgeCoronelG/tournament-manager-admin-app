import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTabsModule } from "@angular/material/tabs";
import {
  ActivatedRoute,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { map } from "rxjs";
import {
  AppBreadcrumbsComponent,
  Crumb,
} from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { GroupsApi } from "../../groups/groups.api";
import { TournamentStatusChipComponent } from "../tournament-status-chip/tournament-status-chip.component";
import { TournamentsApi } from "../tournaments.api";

/**
 * The detail of a finished tournament, read only: its header and a tab per section,
 * each with its own route so the link can be shared and reloading keeps the tab.
 */
@Component({
  selector: "app-tournament-history-detail",
  templateUrl: "./tournament-history-detail.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppBreadcrumbsComponent,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TournamentStatusChipComponent,
    TranslocoPipe,
  ],
})
export class TournamentHistoryDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);

  protected readonly leagueContext = inject(LeagueContextService);

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((params) => Number(params.get("id")) || null)),
    { initialValue: null },
  );

  protected readonly tournamentResource = inject(TournamentsApi).get(
    computed(() => this.id() ?? undefined),
  );

  /** A tournament that is not in the league, does not exist or is not finished has no detail */
  protected readonly tournament = computed(() => {
    const value = this.tournamentResource.hasValue()
      ? this.tournamentResource.value()
      : undefined;

    return value?.status === "finished" ? value : undefined;
  });

  protected readonly notFound = computed(
    () =>
      this.id() === null ||
      !!this.tournamentResource.error() ||
      (this.tournamentResource.hasValue() && !this.tournament()),
  );

  /** The year of the start date: the season */
  protected readonly season = computed(
    () => this.tournament()?.start_date.slice(0, 4) ?? "",
  );

  // Only a tournament with playoffs gets the tab
  private readonly groupsResource = inject(GroupsApi).view(
    computed(() => this.tournament()?.id),
  );
  protected readonly playoffsCount = computed(
    () => this.groupsResource.value()?.playoffs.length ?? 0,
  );
  protected readonly hasPlayoffs = computed(() => this.playoffsCount() > 0);

  protected readonly crumbs = computed<Crumb[]>(() => [
    this.transloco.translate("nav.tournaments"),
    {
      label: this.transloco.translate("nav.history"),
      link: "/dashboard/torneos/historial",
    },
    ...(this.tournament() ? [this.tournament()!.name] : []),
  ]);
}
