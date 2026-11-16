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
    path: "calendario",
    title: "matches.title",
    canActivate: [capabilityGuard("groups.manage")],
    loadComponent: () =>
      import("../matches/matches-page/matches-page.component").then(
        (m) => m.MatchesPageComponent,
      ),
  },
  {
    // The league agenda lives in the calendar now: old links land there
    path: "agenda",
    redirectTo: "calendario",
    pathMatch: "full",
  },
  {
    path: "estadisticas",
    title: "statistics.title",
    canActivate: [capabilityGuard("groups.manage")],
    loadComponent: () =>
      import("../matches/statistics-page/statistics-page.component").then(
        (m) => m.StatisticsPageComponent,
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
