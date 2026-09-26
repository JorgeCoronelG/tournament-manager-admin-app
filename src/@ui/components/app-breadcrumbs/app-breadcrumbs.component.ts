import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { AppBreadcrumbComponent } from "./app-breadcrumb/app-breadcrumb.component";
import { RouterLink } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";

@Component({
  selector: "app-breadcrumbs",
  template: `
    <div class="flex items-center gap-2">
      <app-breadcrumb>
        <a [attr.aria-label]="homeLabel()" [routerLink]="['/']">
          <mat-icon svgIcon="mat:home" class="icon-sm" />
        </a>
      </app-breadcrumb>
      @for (crumb of crumbs(); track crumb) {
        <div class="w-1 h-1 bg-gray-600 rounded-full"></div>
        <app-breadcrumb>
          <a [routerLink]="[]">{{ crumb }}</a>
        </app-breadcrumb>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppBreadcrumbComponent, RouterLink, MatIconModule],
})
export class AppBreadcrumbsComponent {
  readonly crumbs = input<string[]>([]);
  /** Accessible name of the home icon link */
  readonly homeLabel = input("Home");
}
