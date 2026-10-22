import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { TranslocoPipe } from "@jsverse/transloco";
import { RosterStatus } from "../roster.model";

const CLASSES: Record<RosterStatus, string> = {
  pending: "bg-amber-500/10 text-amber-800 dark:text-amber-400",
  active: "bg-green-600/10 text-green-800 dark:text-green-400",
  rejected: "bg-red-600/10 text-red-800 dark:text-red-400",
  cancelled: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  removed: "bg-orange-500/10 text-orange-800 dark:text-orange-400",
};

@Component({
  selector: "app-roster-status-chip",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `<span
    [class]="classes()"
    class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
    >{{ "rosters.status." + status() | transloco }}</span
  >`,
})
export class RosterStatusChipComponent {
  readonly status = input.required<RosterStatus>();

  readonly classes = computed(() => CLASSES[this.status()]);
}
