import { inject, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter, map, startWith } from "rxjs/operators";
import { AppRouteData } from "../interfaces/app-route.interface";
import { checkRouterChildsData } from "./check-router-childs-data";

/**
 * Creates a signal that re-evaluates `compareWith` against the data of the
 * active route (and its children) after every successful navigation.
 * Must be called in an injection context.
 */
export function routeDataSignal(
  compareWith: (data: AppRouteData) => boolean,
): Signal<boolean> {
  const router = inject(Router);

  return toSignal(
    router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() =>
        checkRouterChildsData(router.routerState.root.snapshot, compareWith),
      ),
    ),
    { requireSync: true },
  );
}
