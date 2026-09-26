import { TranslocoPipe } from "@jsverse/transloco";
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  NavigationItem,
  NavigationLink,
} from "../../../../core/navigation/navigation-item.interface";
import { filter } from "rxjs/operators";
import { NavigationEnd, Router, RouterLink } from "@angular/router";
import { NavigationService } from "../../../../core/navigation/navigation.service";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatRippleModule } from "@angular/material/core";
import { NgTemplateOutlet } from "@angular/common";

@Component({
  selector: "app-navigation-item",
  templateUrl: "./navigation-item.component.html",
  styleUrls: ["./navigation-item.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoPipe,
    MatRippleModule,
    RouterLink,
    MatMenuModule,
    MatIconModule,
    NgTemplateOutlet,
  ],
})
export class NavigationItemComponent {
  private navigationService = inject(NavigationService);
  private router = inject(Router);

  readonly item = input.required<NavigationItem>();

  /**
   * Emits after every navigation so `isActive` is re-evaluated in the template
   */
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    { initialValue: null },
  );

  isLink = this.navigationService.isLink;
  isDropdown = this.navigationService.isDropdown;
  isSubheading = this.navigationService.isSubheading;

  isActive(item: NavigationItem): boolean {
    this.navigationEnd();
    return this.hasActiveChilds(item);
  }

  hasActiveChilds(parent: NavigationItem): boolean {
    if (this.isLink(parent)) {
      return this.router.isActive(parent.route as string, true);
    }

    if (this.isDropdown(parent) || this.isSubheading(parent)) {
      return parent.children.some((child) => {
        if (this.isDropdown(child)) {
          return this.hasActiveChilds(child);
        }

        if (this.isLink(child) && !this.isFunction(child.route)) {
          return this.router.isActive(child.route as string, true);
        }

        return false;
      });
    }

    return false;
  }

  isFunction(prop: NavigationLink["route"]): prop is () => void {
    return prop instanceof Function;
  }
}
