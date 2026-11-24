import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * A fixed-arc spinner: unlike `mat-spinner` (indeterminate) the arc never changes length,
 * it only rotates, so at small sizes the icon does not seem to jump. The colour is
 * inherited (`currentColor`). The host always takes the 24px of an icon so swapping
 * an icon for the spinner does not move the button. Decorative: put `aria-busy` on
 * the element that contains it.
 */
@Component({
  selector: "app-spinner",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "inline-flex size-6 shrink-0 items-center justify-center" },
  template: `
    <svg
      [attr.height]="size()"
      [attr.width]="size()"
      aria-hidden="true"
      class="animate-spin motion-reduce:animate-none"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        cx="12"
        cy="12"
        opacity="0.25"
        r="10"
        stroke="currentColor"
        stroke-width="3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="3"
      />
    </svg>
  `,
})
export class SpinnerComponent {
  /** Diameter in px */
  readonly size = input(20);
}
