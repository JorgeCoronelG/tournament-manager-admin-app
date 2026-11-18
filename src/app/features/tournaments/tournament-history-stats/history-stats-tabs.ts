import { Route } from "@angular/router";

/** A section inside the Statistics tab of a finished tournament */
export interface HistoryStatsTab {
  /** Child route: /historial/:id/estadisticas/{path} */
  path: string;
  /** Translation key of the tab's text and of the page's title */
  label: string;
  loadComponent: NonNullable<Route["loadComponent"]>;
}

/**
 * The inner tabs, in order. To add one (scorers, cards...), add it here: the tab row
 * and the routes are both built from this list. The first one opens by default.
 */
export const HISTORY_STATS_TABS: readonly HistoryStatsTab[] = [
  {
    path: "posiciones",
    label: "tournaments.history.stats.tabs.standings",
    loadComponent: () =>
      import("../tournament-history-standings/tournament-history-standings.component").then(
        (m) => m.TournamentHistoryStandingsComponent,
      ),
  },
];
