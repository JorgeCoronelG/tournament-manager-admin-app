import { Service, signal } from "@angular/core";
import { NavigationItem } from "./navigation-item.interface";

@Service()
export class NavigationLoaderService {
  private readonly _items = signal<NavigationItem[]>([]);
  readonly items = this._items.asReadonly();

  constructor() {
    this.loadNavigation();
  }

  loadNavigation(): void {
    // Labels are translation keys (see assets/i18n)
    this._items.set([
      {
        type: "subheading",
        label: "nav.main",
        children: [
          {
            type: "link",
            label: "nav.dashboard",
            route: "/",
            icon: "mat:dashboard",
            routerLinkActiveOptions: { exact: true },
          },
          {
            type: "link",
            label: "nav.customers",
            route: "/customers",
            icon: "mat:people",
          },
        ],
      },
    ]);
  }
}
