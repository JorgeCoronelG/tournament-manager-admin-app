import { effect, inject, Service, signal } from "@angular/core";
import { BreakpointObserver } from "@angular/cdk/layout";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs/operators";
import { mediaDown, mediaUp } from "../tailwind/breakpoints";

@Service()
export class AppLayoutService {
  private readonly breakpointObserver = inject(BreakpointObserver);

  private readonly _sidenavOpen = signal(false);
  readonly sidenavOpen = this._sidenavOpen.asReadonly();

  private readonly _sidenavCollapsed = signal(false);
  readonly sidenavCollapsed = this._sidenavCollapsed.asReadonly();

  private readonly _sidenavCollapsedOpen = signal(false);
  readonly sidenavCollapsedOpen = this._sidenavCollapsedOpen.asReadonly();

  readonly isDesktop = this.observeQuery(mediaUp("lg"));
  readonly ltLg = this.observeQuery(mediaDown("lg"));
  readonly gtMd = this.observeQuery(mediaUp("md"));
  readonly ltMd = this.observeQuery(mediaDown("md"));
  readonly gtSm = this.observeQuery(mediaUp("sm"));
  readonly isMobile = this.observeQuery(mediaDown("sm"));

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
}
