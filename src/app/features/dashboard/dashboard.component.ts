import { httpResource } from "@angular/common/http";
import { DecimalPipe, NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import { AppBreadcrumbsComponent } from "@ui/components/app-breadcrumbs/app-breadcrumbs.component";
import { AppPageLayoutContentDirective } from "@ui/components/app-page-layout/app-page-layout-content.directive";
import { AppPageLayoutComponent } from "@ui/components/app-page-layout/app-page-layout.component";
import { AppSecondaryToolbarComponent } from "@ui/components/app-secondary-toolbar/app-secondary-toolbar.component";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { SettingsService } from "../../core/settings/settings.service";
import { CurrentUserService } from "../../core/user/current-user.service";

/**
 * `GET /dashboard/summary` (superadmin, with `?league_id` for one league) and
 * `GET /leagues/{id}/dashboard/summary` (league admin, without `leagues_active`):
 * everything comes calculated by the backend
 */
interface DashboardSummary {
  /** Always the whole system's total; the league admin's summary does not carry it */
  leagues_active?: number;
  tournaments_active: number;
  teams_in_active_tournaments: number;
  players_in_active_tournaments: number;
  matches_this_week: number;
  referees_active: number;
  /** Y-m-d, Monday and Sunday of the current week */
  week: { from: string; to: string };
}

@Component({
  selector: "app-dashboard",
  templateUrl: "./dashboard.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppBreadcrumbsComponent,
    AppPageLayoutComponent,
    AppPageLayoutContentDirective,
    AppSecondaryToolbarComponent,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    NgTemplateOutlet,
    TranslocoPipe,
  ],
})
export class DashboardComponent {
  private readonly currentUser = inject(CurrentUserService);
  protected readonly leagueContext = inject(LeagueContextService);
  private readonly settings = inject(SettingsService);
  private readonly transloco = inject(TranslocoService);

  /** The superadmin's six cards: global, or one league's with "Ligas activas" still the total */
  protected readonly isSuperadmin = computed(() =>
    this.currentUser.user().roles.includes("superadmin"),
  );
  /** The league admin's five cards, always of their selected league */
  protected readonly isLeagueAdmin = computed(
    () => !this.isSuperadmin() && this.currentUser.can("leagues.select"),
  );

  /** The figures are one league's (not the whole system's) */
  private readonly ofLeague = computed(
    () => this.isLeagueAdmin() || this.leagueContext.activeLeagueId() !== null,
  );

  protected readonly resource = httpResource<DashboardSummary>(() => {
    if (this.isSuperadmin()) {
      const leagueId = this.leagueContext.activeLeagueId();

      return {
        url: this.settings.authApi("/dashboard/summary"),
        ...(leagueId === null ? {} : { params: { league_id: leagueId } }),
      };
    }

    // Waits while there is no league (the league admin is asked to pick one)
    const url = this.isLeagueAdmin()
      ? this.leagueContext.leagueApi("/dashboard/summary")
      : undefined;

    return url ? { url } : undefined;
  });

  /** While loading: a placeholder per card, all of them animated the same */
  protected readonly loadingCards = computed(() =>
    this.isSuperadmin()
      ? [null, null, null, null, null, null]
      : [null, null, null, null, null],
  );

  /** What to tell the league admin while there is no league to show */
  protected readonly leagueMessage = computed(() => {
    // The superadmin does not need a league: with none the cards are the whole system's
    if (!this.isLeagueAdmin() || this.leagueContext.activeLeague()) {
      return null;
    }

    return this.leagueContext.leagues().length === 0
      ? this.leagueContext.disabled()
        ? "leagueSelector.disabled"
        : "leagueSelector.noneAdmin"
      : "dashboard.pickLeague";
  });

  /** The cards, left to right; the icons are the ones of the side menu */
  protected readonly cards = computed(() => {
    const summary = this.resource.hasValue() ? this.resource.value() : null;

    return summary
      ? [
          ...(summary.leagues_active === undefined
            ? []
            : [
                {
                  key: "leagues",
                  icon: "mat:sports_soccer",
                  value: summary.leagues_active,
                },
              ]),
          {
            key: "tournaments",
            icon: "mat:emoji_events",
            value: summary.tournaments_active,
          },
          {
            key: "teams",
            icon: "mat:groups",
            value: summary.teams_in_active_tournaments,
          },
          {
            key: "players",
            icon: "mat:sports_soccer",
            value: summary.players_in_active_tournaments,
          },
          {
            key: "matches",
            icon: "mat:calendar_month",
            value: summary.matches_this_week,
          },
          {
            key: "referees",
            icon: "mat:sports",
            value: summary.referees_active,
          },
        ]
      : [];
  });

  /** "16/11/2026" from a Y-m-d date */
  private short(date: string): string {
    return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
  }

  /** The definition of a card, with the week's dates in the matches one */
  protected tip(key: string): string {
    const week = this.resource.hasValue() ? this.resource.value().week : null;

    // "Ligas activas" always counts the whole system; the rest follow the league when there is one
    const set = key !== "leagues" && this.ofLeague() ? "tipsLeague" : "tips";

    return this.transloco.translate(`dashboard.${set}.${key}`, {
      from: week ? this.short(week.from) : "",
      to: week ? this.short(week.to) : "",
    });
  }

  readonly crumbs = computed(() => [this.transloco.translate("nav.dashboard")]);
}
