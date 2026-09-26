import { TranslocoPipe } from "@jsverse/transloco";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from "@angular/core";
import {
  NavigationDropdown,
  NavigationItem,
  NavigationLink,
} from "../../../../core/navigation/navigation-item.interface";
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
} from "@angular/router";
import { filter } from "rxjs/operators";
import { NavigationService } from "../../../../core/navigation/navigation.service";

import { MatIconModule } from "@angular/material/icon";
import { MatRippleModule } from "@angular/material/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

@Component({
  selector: "app-sidenav-item",
  templateUrl: "./sidenav-item.component.html",
  styleUrls: ["./sidenav-item.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]": "levelClass()",
  },
  imports: [
    TranslocoPipe,
    MatRippleModule,
    RouterLinkActive,
    RouterLink,
    MatIconModule,
  ],
})
export class SidenavItemComponent {
  private router = inject(Router);
  private navigationService = inject(NavigationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly item = input.required<NavigationItem>();
  readonly level = input.required<number>();
  readonly isOpen = signal(false);
  readonly isActive = signal(false);

  isLink = this.navigationService.isLink;
  isDropdown = this.navigationService.isDropdown;
  isSubheading = this.navigationService.isSubheading;

  readonly levelClass = () => `item-level-${this.level()}`;

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        filter(() => this.isDropdown(this.item())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.onRouteChange());

    this.navigationService.openChange$
      .pipe(
        filter(() => this.isDropdown(this.item())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((item) => this.onOpenChange(item));

    effect(() => {
      if (this.isDropdown(this.item())) {
        untracked(() => this.onRouteChange());
      }
    });
  }

  toggleOpen() {
    this.isOpen.update((isOpen) => !isOpen);
    this.navigationService.triggerOpenChange(this.item() as NavigationDropdown);
  }

  onOpenChange(item: NavigationDropdown) {
    const current = this.item() as NavigationDropdown;

    if (this.isChildrenOf(current, item)) {
      return;
    }

    if (this.hasActiveChilds(current)) {
      return;
    }

    if (current !== item) {
      this.isOpen.set(false);
    }
  }

  onRouteChange() {
    const hasActiveChilds = this.hasActiveChilds(
      this.item() as NavigationDropdown,
    );

    this.isActive.set(hasActiveChilds);
    this.isOpen.set(hasActiveChilds);
    this.navigationService.triggerOpenChange(this.item() as NavigationDropdown);
  }

  isChildrenOf(parent: NavigationDropdown, item: NavigationDropdown): boolean {
    if (parent.children.indexOf(item) !== -1) {
      return true;
    }

    return parent.children
      .filter((child) => this.isDropdown(child))
      .some((child) => this.isChildrenOf(child as NavigationDropdown, item));
  }

  hasActiveChilds(parent: NavigationDropdown): boolean {
    return parent.children.some((child) => {
      if (this.isDropdown(child)) {
        return this.hasActiveChilds(child);
      }

      if (this.isLink(child) && !this.isFunction(child.route)) {
        return this.router.isActive(child.route as string, false);
      }
    });
  }

  isFunction(prop: NavigationLink["route"]): prop is () => void {
    return prop instanceof Function;
  }
}
