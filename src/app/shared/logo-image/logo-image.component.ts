import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

/**
 * A logo (e.g. a team's), sized/shaped by the classes the caller puts on the
 * host (`class="w-10 h-10 rounded-full"`). Shows a shield icon on a neutral
 * circle when there is no image or it fails to load.
 */
@Component({
  selector: "app-logo-image",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  host: { class: "block overflow-hidden" },
  template: `
    @if (showImage()) {
      <img
        (error)="failed.set(true)"
        [alt]="alt()"
        [src]="src()"
        class="w-full h-full object-cover"
        loading="lazy"
      />
    } @else {
      <span
        class="w-full h-full flex items-center justify-center bg-gray-500/10 text-gray-500 dark:text-gray-400"
      >
        <mat-icon svgIcon="mat:shield" />
      </span>
    }
  `,
})
export class LogoImageComponent {
  readonly src = input<string | null>(null);
  /** Alternative text of the image (the icon is decorative) */
  readonly alt = input("");

  // Resets whenever `src` changes, so a new image gets a fresh chance to load
  protected readonly failed = linkedSignal({
    source: this.src,
    computation: () => false,
  });

  protected readonly showImage = computed(() => !!this.src() && !this.failed());
}
