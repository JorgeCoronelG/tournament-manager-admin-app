import { LayoutComponent } from "./layouts/layout/layout.component";
import { AppRoutes } from "@ui/interfaces/app-route.interface";
import { customersRoutes } from "./features/customers/customers.routes";
import { environment } from "../environments/environment";

export const appRoutes: AppRoutes = [
  {
    path: "",
    component: LayoutComponent,
    children: [
      {
        path: "",
        pathMatch: "full",
        title: "dashboard.title",
        loadComponent: () =>
          import("./features/dashboard/dashboard.component").then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: "customers",
        children: customersRoutes,
      },
      ...(environment.features.styleguide
        ? [
            {
              path: "styleguide",
              title: "styleguide.title",
              loadComponent: () =>
                import("./features/styleguide/styleguide.component").then(
                  (m) => m.StyleguideComponent,
                ),
            },
          ]
        : []),
      {
        path: "**",
        title: "notFound.title",
        loadComponent: () =>
          import("./features/not-found/not-found.component").then(
            (m) => m.NotFoundComponent,
          ),
      },
    ],
  },
];
