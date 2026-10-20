import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { TranslocoPipe } from "@jsverse/transloco";
import { TeamStatus } from "../team.model";

const CLASSES: Record<TeamStatus, string> = {
  active: "bg-green-600/10 text-green-800 dark:text-green-400",
  banned: "bg-red-600/10 text-red-800 dark:text-red-400",
};

@Component({
  selector: "app-team-status-chip",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `<span
    [class]="classes()"
    class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
    >{{ "teams.status." + status() | transloco }}</span
  >`,
})
export class TeamStatusChipComponent {
  readonly status = input.required<TeamStatus>();

  readonly classes = computed(() => CLASSES[this.status()]);
}
