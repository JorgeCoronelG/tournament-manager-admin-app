import { Component } from "@angular/core";

@Component({
  selector: "app-breadcrumb",
  template: ` <ng-content /> `,
  styles: [],
  host: {
    class:
      "app-breadcrumb body-2 text-hint leading-none hover:text-primary-600 no-underline transition duration-400 ease-out-swift",
  },
})
export class AppBreadcrumbComponent {}
