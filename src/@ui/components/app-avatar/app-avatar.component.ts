import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

/**
 * Renders a user's photo, sized/shaped by whatever classes the caller puts
 * on the host (e.g. `class="w-10 h-10 rounded-full"`). Falls back to a
 * person icon when there is no photo, or if it fails to load.
 */
@Component({
  selector: "app-avatar",
  templateUrl: "./app-avatar.component.html",
  styleUrls: ["./app-avatar.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
})
export class AppAvatarComponent {
  readonly src = input<string | null>(null);

  // Resets whenever `src` changes, so a new photo gets a fresh chance to load.
  private readonly failed = linkedSignal({
    source: this.src,
    computation: () => false,
  });

  readonly showImage = computed(() => !!this.src() && !this.failed());

  onError(): void {
    this.failed.set(true);
  }
}
