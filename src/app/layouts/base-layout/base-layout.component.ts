import {
  AfterViewInit,
  Component,
  DestroyRef,
  inject,
  DOCUMENT,
  ChangeDetectionStrategy,
  computed,
  contentChild,
  effect,
  untracked,
} from "@angular/core";
import { AppLayoutService } from "@ui/services/app-layout.service";
import {
  MatSidenavContainer,
  MatSidenavModule,
} from "@angular/material/sidenav";
import { Event, NavigationEnd, Router, Scroll } from "@angular/router";
import { filter } from "rxjs/operators";

import { AppConfigService } from "@ui/config/app-config.service";

import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { routeDataSignal } from "@ui/utils/route-data-signal";

@Component({
  selector: "app-base-layout",
  templateUrl: "./base-layout.component.html",
  styleUrls: ["./base-layout.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSidenavModule],
})
export class BaseLayoutComponent implements AfterViewInit {
  private readonly layoutService = inject(AppLayoutService);
  private readonly configService = inject(AppConfigService);
  private readonly router = inject(Router);
  private readonly document = inject<Document>(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly config = this.configService.config;

  /**
   * Footer is visible when it is enabled in the config and on the current route
   */
  private readonly routeFooterVisible = routeDataSignal(
    (data) => data.footerVisible ?? true,
  );
  readonly isFooterVisible = computed(
    () => this.config().footer.visible && this.routeFooterVisible(),
  );

  readonly sidenavCollapsed = this.layoutService.sidenavCollapsed;
  readonly isDesktop = this.layoutService.isDesktop;
  readonly scrollDisabled = routeDataSignal(
    (data) => data.scrollDisabled ?? false,
  );
  readonly searchOpen = this.layoutService.searchOpen;

  readonly sidenavContainer = contentChild.required(MatSidenavContainer);

  constructor() {
    /**
     * Open sidenav on desktop when layout is not vertical
     * Close sidenav on mobile or when layout is vertical
     */
    effect(() => {
      const isDesktop = this.isDesktop();
      const isVerticalLayout = this.config().layout === "vertical";

      untracked(() =>
        isDesktop && !isVerticalLayout
          ? this.layoutService.openSidenav()
          : this.layoutService.closeSidenav(),
      );
    });

    /**
     * Mobile only:
     * Close Sidenav after Navigating somewhere (e.g. when a user clicks a link in the Sidenav)
     */
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        filter(() => !this.isDesktop()),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.layoutService.closeSidenav());
  }

  ngAfterViewInit(): void {
    /**
     * Enable Scrolling to specific parts of the page using the Router
     */
    this.router.events
      .pipe(
        filter<Event, Scroll>((e: Event): e is Scroll => e instanceof Scroll),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        if (e.position) {
          // backward navigation
          this.sidenavContainer().scrollable.scrollTo({
            start: e.position[0],
            top: e.position[1],
          });
        } else if (e.anchor) {
          // anchor navigation

          const scroll = (anchor: HTMLElement) =>
            this.sidenavContainer().scrollable.scrollTo({
              behavior: "smooth",
              top: anchor.offsetTop,
              left: anchor.offsetLeft,
            });

          let anchorElem = this.document.getElementById(e.anchor);

          if (anchorElem) {
            scroll(anchorElem);
          } else {
            setTimeout(() => {
              if (!e.anchor) {
                return;
              }

              anchorElem = this.document.getElementById(e.anchor);

              if (!anchorElem) {
                return;
              }

              scroll(anchorElem);
            }, 100);
          }
        } else {
          // forward navigation
          this.sidenavContainer().scrollable.scrollTo({
            top: 0,
            start: 0,
          });
        }
      });
  }
}
