import { ActivatedRouteSnapshot } from "@angular/router";
import { AppRouteData } from "../interfaces/app-route.interface";

export function checkRouterChildsData(
  route: ActivatedRouteSnapshot & {
    data?: AppRouteData;
  },
  compareWith: (data: AppRouteData) => boolean,
): boolean {
  if (compareWith(route.data)) {
    return true;
  }

  if (!route.firstChild) {
    return false;
  }

  return checkRouterChildsData(route.firstChild, compareWith);
}
