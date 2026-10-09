import { Routes } from "@angular/router";

export const tournamentsRoutes: Routes = [
  {
    path: "",
    title: "tournaments.title",
    loadComponent: () =>
      import("./tournaments-list/tournaments-list.component").then(
        (m) => m.TournamentsListComponent,
      ),
  },
];
