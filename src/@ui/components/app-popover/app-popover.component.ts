import {
  Component,
  TemplateRef,
  ChangeDetectionStrategy,
  inject,
} from "@angular/core";
import { AppPopoverRef } from "./app-popover-ref";
import { NgComponentOutlet, NgTemplateOutlet } from "@angular/common";

@Component({
  selector: "app-popover",
  templateUrl: "./app-popover.component.html",
  styleUrls: ["./app-popover.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, NgComponentOutlet],
})
export class AppPopoverComponent {
  private popoverRef = inject(AppPopoverRef);

  private readonly content = this.popoverRef.content;

  readonly text = typeof this.content === "string" ? this.content : null;
  readonly template = this.content instanceof TemplateRef ? this.content : null;
  readonly component = typeof this.content === "function" ? this.content : null;
  readonly context = {
    close: this.popoverRef.close.bind(this.popoverRef),
  };
}
