import { computed, inject, Service } from "@angular/core";
import { CurrentUserService } from "../user/current-user.service";
import { filterNavigation } from "./navigation-filter";
import { NavigationItem } from "./navigation-item.interface";

/**
 * Every entry of the menu. `capability` decides who sees it (see
 * `role-capabilities.ts`); leave it out for entries any signed-in user can use.
 * Labels are translation keys (see assets/i18n).
 */
const NAVIGATION: NavigationItem[] = [
  {
    type: "subheading",
    label: "nav.main",
    children: [
      {
        type: "link",
        label: "nav.dashboard",
        route: "/dashboard",
        icon: "mat:dashboard",
        routerLinkActiveOptions: { exact: true },
      },
      {
        type: "dropdown",
        label: "nav.users",
        icon: "mat:manage_accounts",
        capability: "users.manage",
        children: [
          {
            type: "link",
            label: "nav.manage",
            route: "/dashboard/usuarios",
          },
        ],
      },
      {
        type: "dropdown",
        label: "nav.leagues",
        icon: "mat:sports_soccer",
        capability: "leagues.manage",
        children: [
          {
            type: "link",
            label: "nav.manage",
            route: "/dashboard/ligas",
          },
        ],
      },
    ],
  },
];

@Service()
export class NavigationLoaderService {
  private readonly currentUser = inject(CurrentUserService);

  /** Recomputed when the signed-in user (and so their roles) changes */
  readonly items = computed(() =>
    filterNavigation(NAVIGATION, (capability) =>
      this.currentUser.can(capability),
    ),
  );
}
