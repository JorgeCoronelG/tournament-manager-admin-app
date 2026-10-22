import { Routes } from "@angular/router";

export const playersRoutes: Routes = [
  {
    path: "",
    title: "players.title",
    loadComponent: () =>
      import("./players-list/players-list.component").then(
        (m) => m.PlayersListComponent,
      ),
  },
];
