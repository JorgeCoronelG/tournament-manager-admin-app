import { Routes } from "@angular/router";

export const fieldsRoutes: Routes = [
  {
    path: "",
    title: "fields.title",
    loadComponent: () =>
      import("./fields-list/fields-list.component").then(
        (m) => m.FieldsListComponent,
      ),
  },
];
