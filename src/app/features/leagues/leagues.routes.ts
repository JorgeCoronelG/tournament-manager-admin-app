import { Routes } from "@angular/router";

export const leaguesRoutes: Routes = [
  {
    path: "",
    title: "leagues.title",
    loadComponent: () =>
      import("./leagues-list/leagues-list.component").then(
        (m) => m.LeaguesListComponent,
      ),
  },
];
