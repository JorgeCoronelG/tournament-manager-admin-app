import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input,
} from "@angular/core";

@Component({
  selector: "app-page-layout",
  template: "<ng-content />",
  host: {
    class: "app-page-layout",
    "[class.app-page-layout-card]": "mode() === 'card'",
    "[class.app-page-layout-simple]": "mode() === 'simple'",
  },
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ["./app-page-layout.component.scss"],
})
export class AppPageLayoutComponent {
  readonly mode = input<"card" | "simple">("simple");
}
