import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { Router } from "@angular/router";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { LeagueContextService } from "../../../core/league-context/league-context.service";
import { LeagueRequiredComponent } from "../../../shared/league-required/league-required.component";
import { TournamentsApi } from "../../tournaments/tournaments.api";
import { AgendaViewComponent } from "../agenda-view/agenda-view.component";

/** The matches of the whole league by day or week, with their field and referee */
@Component({
  selector: "app-agenda-page",
  templateUrl: "./agenda-page.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AgendaViewComponent,
    AppBreadcrumbsComponent,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
    LeagueRequiredComponent,
    TranslocoPipe,
  ],
})
export class AgendaPageComponent {
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  protected readonly leagueContext = inject(LeagueContextService);

  private readonly tournamentsResource = inject(TournamentsApi).options([
    "in_progress",
  ]);
  readonly tournaments = computed(() =>
    this.tournamentsResource.hasValue()
      ? this.tournamentsResource.value().data
      : [],
  );

  readonly crumbs = computed(() => [
    this.transloco.translate("nav.tournaments"),
    this.transloco.translate("nav.agenda"),
  ]);

  /** A tournament's link in the agenda: its calendar opens */
  openCalendar(tournamentId: number): void {
    void this.router.navigate(["/dashboard/torneos/calendario"], {
      queryParams: { torneo: tournamentId },
    });
  }
}
