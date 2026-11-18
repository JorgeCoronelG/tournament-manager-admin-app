import { Routes, UrlMatchResult } from "@angular/router";
import { capabilityGuard } from "../../core/auth/capability.guard";
import { HISTORY_STATS_TABS } from "./tournament-history-stats/history-stats-tabs";

export const tournamentsRoutes: Routes = [
  {
    path: "",
    title: "tournaments.title",
    loadComponent: () =>
      import("./tournaments-list/tournaments-list.component").then(
        (m) => m.TournamentsListComponent,
      ),
  },
  {
    path: "inscripciones",
    title: "registrations.title",
    canActivate: [capabilityGuard("registrations.manage")],
    loadComponent: () =>
      import("../registrations/registrations-page/registrations-page.component").then(
        (m) => m.RegistrationsPageComponent,
      ),
  },
  {
    path: "grupos",
    title: "groups.title",
    canActivate: [capabilityGuard("groups.manage")],
    loadComponent: () =>
      import("../groups/groups-page/groups-page.component").then(
        (m) => m.GroupsPageComponent,
      ),
  },
  {
    path: "calendario",
    title: "matches.title",
    canActivate: [capabilityGuard("groups.manage")],
    loadComponent: () =>
      import("../matches/matches-page/matches-page.component").then(
        (m) => m.MatchesPageComponent,
      ),
  },
  {
    // The league agenda lives in the calendar now: old links land there
    path: "agenda",
    redirectTo: "calendario",
    pathMatch: "full",
  },
  {
    path: "estadisticas",
    title: "statistics.title",
    canActivate: [capabilityGuard("groups.manage")],
    loadComponent: () =>
      import("../matches/statistics-page/statistics-page.component").then(
        (m) => m.StatisticsPageComponent,
      ),
  },
  {
    path: "historial",
    canActivate: [capabilityGuard("groups.manage")],
    children: [
      {
        path: "",
        title: "tournaments.history.title",
        loadComponent: () =>
          import("./tournament-history/tournament-history.component").then(
            (m) => m.TournamentHistoryComponent,
          ),
      },
      {
        path: ":id",
        loadComponent: () =>
          import("./tournament-history-detail/tournament-history-detail.component").then(
            (m) => m.TournamentHistoryDetailComponent,
          ),
        children: [
          { path: "", pathMatch: "full", redirectTo: "resumen" },
          {
            path: "resumen",
            title: "tournaments.history.detail.tabs.summary",
            loadComponent: () =>
              import("./tournament-history-summary/tournament-history-summary.component").then(
                (m) => m.TournamentHistorySummaryComponent,
              ),
          },
          {
            path: "calendario",
            title: "tournaments.history.detail.tabs.calendar",
            loadComponent: () =>
              import("./tournament-history-calendar/tournament-history-calendar.component").then(
                (m) => m.TournamentHistoryCalendarComponent,
              ),
          },
          {
            // "liguilla" or "liguilla/:playoffId": the same component, so changing playoff does not reload it
            matcher: (segments): UrlMatchResult | null => {
              if (segments[0]?.path !== "liguilla" || segments.length > 2) {
                return null;
              }

              const playoffId = segments[1];

              return {
                consumed: segments,
                posParams: playoffId ? { playoffId } : undefined,
              };
            },
            title: "tournaments.history.detail.tabs.playoffs",
            loadComponent: () =>
              import("./tournament-history-playoffs/tournament-history-playoffs.component").then(
                (m) => m.TournamentHistoryPlayoffsComponent,
              ),
          },
          {
            path: "estadisticas",
            loadComponent: () =>
              import("./tournament-history-stats/tournament-history-stats.component").then(
                (m) => m.TournamentHistoryStatsComponent,
              ),
            children: [
              {
                path: "",
                pathMatch: "full",
                redirectTo: HISTORY_STATS_TABS[0].path,
              },
              ...HISTORY_STATS_TABS.map((tab) => ({
                path: tab.path,
                title: tab.label,
                loadComponent: tab.loadComponent,
              })),
            ],
          },
        ],
      },
    ],
  },
  {
    path: "plantillas",
    title: "rosters.title",
    canActivate: [capabilityGuard("rosters.manage")],
    loadComponent: () =>
      import("../rosters/rosters-page/rosters-page.component").then(
        (m) => m.RostersPageComponent,
      ),
  },
];
