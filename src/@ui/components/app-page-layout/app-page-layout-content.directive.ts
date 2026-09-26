import { Directive } from "@angular/core";

@Directive({
  selector: "[appPageLayoutContent],app-page-layout-content",
  host: {
    class: "app-page-layout-content",
  },
})
export class AppPageLayoutContentDirective {}
