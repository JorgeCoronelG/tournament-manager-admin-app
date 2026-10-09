import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { TranslocoPipe } from "@jsverse/transloco";
import { RefereeLeagueStatus } from "../referee.model";

const CLASSES: Record<RefereeLeagueStatus, string> = {
  active: "bg-green-600/10 text-green-800 dark:text-green-400",
  inactive: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

/** The referee's status in the league */
@Component({
  selector: "app-referee-status-chip",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `<span
    [class]="classes()"
    class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
    >{{ "referees.leagueStatus." + status() | transloco }}</span
  >`,
})
export class RefereeStatusChipComponent {
  readonly status = input.required<RefereeLeagueStatus>();

  readonly classes = computed(() => CLASSES[this.status()]);
}
