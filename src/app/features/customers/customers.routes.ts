import { Routes } from "@angular/router";

export const customersRoutes: Routes = [
  {
    path: "",
    title: "customers.title",
    loadComponent: () =>
      import("./customers-list.component").then(
        (m) => m.CustomersListComponent,
      ),
  },
  {
    path: ":id",
    title: "customers.detail.title",
    loadComponent: () =>
      import("./customer-detail.component").then(
        (m) => m.CustomerDetailComponent,
      ),
  },
];
