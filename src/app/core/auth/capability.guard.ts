import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { Capability } from "./role-capabilities";
import { CurrentUserService } from "../user/current-user.service";

/**
 * Restricts a route to users holding the capability. It relies on `authGuard`
 * having run on a parent route, which is what loads the current user.
 */
export function capabilityGuard(capability: Capability): CanActivateFn {
  return () => {
    const currentUser = inject(CurrentUserService);
    const router = inject(Router);

    return currentUser.can(capability) || router.createUrlTree(["/dashboard"]);
  };
}
