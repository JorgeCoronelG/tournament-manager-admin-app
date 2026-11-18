import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { AppBreadcrumbComponent } from "./app-breadcrumb/app-breadcrumb.component";
import { RouterLink } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";

/** A crumb: plain text, or text that goes to `link` */
export type Crumb = string | { label: string; link?: string };

@Component({
  selector: "app-breadcrumbs",
  template: `
    <div class="flex items-center gap-2">
      <app-breadcrumb>
        <a [attr.aria-label]="homeLabel()" [routerLink]="['/']">
          <mat-icon svgIcon="mat:home" class="icon-sm" />
        </a>
      </app-breadcrumb>
      @for (crumb of crumbs(); track $index) {
        <div class="w-1 h-1 bg-gray-600 rounded-full"></div>
        <app-breadcrumb>
          @if (isText(crumb)) {
            <a [routerLink]="[]">{{ crumb }}</a>
          } @else {
            <a [routerLink]="crumb.link ?? []">{{ crumb.label }}</a>
          }
        </app-breadcrumb>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppBreadcrumbComponent, RouterLink, MatIconModule],
})
export class AppBreadcrumbsComponent {
  readonly crumbs = input<Crumb[]>([]);
  /** Accessible name of the home icon link */
  readonly homeLabel = input("Home");

  protected isText(crumb: Crumb): crumb is string {
    return typeof crumb === "string";
  }
}
