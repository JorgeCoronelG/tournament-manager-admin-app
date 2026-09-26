import {
  Component,
  DOCUMENT,
  ChangeDetectionStrategy,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
} from "@angular/core";

@Component({
  selector: "app-sidebar",
  templateUrl: "./app-sidebar.component.html",
  styleUrls: ["./app-sidebar.component.scss"],
  host: {
    class: "app-sidebar",
    "(document:keydown.escape)": "opened() && close()",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppSidebarComponent {
  private document = inject<Document>(DOCUMENT);

  readonly position = input<"left" | "right">("left");
  readonly invisibleBackdrop = input<boolean>(false);
  readonly opened = model<boolean>(false);

  readonly positionLeft = computed(() => this.position() === "left");
  readonly positionRight = computed(() => this.position() === "right");

  constructor() {
    effect(() =>
      this.opened() ? this.enableScrollblock() : this.disableScrollblock(),
    );

    inject(DestroyRef).onDestroy(() => this.disableScrollblock());
  }

  enableScrollblock() {
    this.document.body.classList.add("app-scrollblock");
  }

  disableScrollblock() {
    this.document.body.classList.remove("app-scrollblock");
  }

  open() {
    this.opened.set(true);
  }

  close() {
    this.opened.set(false);
  }
}
