import { Routes } from "@angular/router";

export const refereesRoutes: Routes = [
  {
    path: "",
    title: "referees.title",
    loadComponent: () =>
      import("./referees-list/referees-list.component").then(
        (m) => m.RefereesListComponent,
      ),
  },
];
