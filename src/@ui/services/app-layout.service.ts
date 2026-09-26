import { effect, inject, Service, signal } from "@angular/core";
import { BreakpointObserver } from "@angular/cdk/layout";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs/operators";

@Service()
export class AppLayoutService {
  private readonly breakpointObserver = inject(BreakpointObserver);

  private readonly _sidenavOpen = signal(false);
  readonly sidenavOpen = this._sidenavOpen.asReadonly();

  private readonly _sidenavCollapsed = signal(false);
  readonly sidenavCollapsed = this._sidenavCollapsed.asReadonly();

  private readonly _sidenavCollapsedOpen = signal(false);
  readonly sidenavCollapsedOpen = this._sidenavCollapsedOpen.asReadonly();

  private readonly _configPanelOpen = signal(false);
  readonly configPanelOpen = this._configPanelOpen.asReadonly();

  private readonly _searchOpen = signal(false);
  readonly searchOpen = this._searchOpen.asReadonly();

  readonly isDesktop = this.observeQuery("(min-width: 1280px)");
  readonly ltLg = this.observeQuery("(max-width: 1279px)");
  readonly gtMd = this.observeQuery("(min-width: 960px)");
  readonly ltMd = this.observeQuery("(max-width: 959px)");
  readonly gtSm = this.observeQuery("(min-width: 600px)");
  readonly isMobile = this.observeQuery("(max-width: 599px)");

  constructor() {
    /**
     * Expand Sidenav when we switch from desktop to mobile view
     */
    effect(() => {
      if (!this.isDesktop()) {
        this.expandSidenav();
      }
    });
  }

  private observeQuery(query: string) {
    return toSignal(
      this.breakpointObserver
        .observe(query)
        .pipe(map((state) => state.matches)),
      { initialValue: this.breakpointObserver.isMatched(query) },
    );
  }

  openSidenav() {
    this._sidenavOpen.set(true);
  }

  closeSidenav() {
    this._sidenavOpen.set(false);
  }

  collapseSidenav() {
    this._sidenavCollapsed.set(true);
  }

  expandSidenav() {
    this._sidenavCollapsed.set(false);
  }

  collapseOpenSidenav() {
    this._sidenavCollapsedOpen.set(true);
  }

  collapseCloseSidenav() {
    this._sidenavCollapsedOpen.set(false);
  }

  openConfigpanel() {
    this._configPanelOpen.set(true);
  }

  closeConfigpanel() {
    this._configPanelOpen.set(false);
  }

  openSearch() {
    this._searchOpen.set(true);
  }

  closeSearch() {
    this._searchOpen.set(false);
  }
}
