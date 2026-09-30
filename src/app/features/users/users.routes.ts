import { Routes } from "@angular/router";

export const usersRoutes: Routes = [
  {
    path: "",
    title: "users.title",
    loadComponent: () =>
      import("./users-list/users-list.component").then(
        (m) => m.UsersListComponent,
      ),
  },
];
