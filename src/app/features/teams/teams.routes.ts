import { Routes } from "@angular/router";

export const teamsRoutes: Routes = [
  {
    path: "",
    title: "teams.title",
    loadComponent: () =>
      import("./teams-list/teams-list.component").then(
        (m) => m.TeamsListComponent,
      ),
  },
];
