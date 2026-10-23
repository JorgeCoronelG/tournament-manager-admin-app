import { Routes } from "@angular/router";
import { capabilityGuard } from "../../core/auth/capability.guard";

export const tournamentsRoutes: Routes = [
  {
    path: "",
    title: "tournaments.title",
    loadComponent: () =>
      import("./tournaments-list/tournaments-list.component").then(
        (m) => m.TournamentsListComponent,
      ),
  },
  {
    path: "inscripciones",
    title: "registrations.title",
    canActivate: [capabilityGuard("registrations.manage")],
    loadComponent: () =>
      import("../registrations/registrations-page/registrations-page.component").then(
        (m) => m.RegistrationsPageComponent,
      ),
  },
  {
    path: "grupos",
    title: "groups.title",
    canActivate: [capabilityGuard("groups.manage")],
    loadComponent: () =>
      import("../groups/groups-page/groups-page.component").then(
        (m) => m.GroupsPageComponent,
      ),
  },
  {
    path: "plantillas",
    title: "rosters.title",
    canActivate: [capabilityGuard("rosters.manage")],
    loadComponent: () =>
      import("../rosters/rosters-page/rosters-page.component").then(
        (m) => m.RostersPageComponent,
      ),
  },
];
