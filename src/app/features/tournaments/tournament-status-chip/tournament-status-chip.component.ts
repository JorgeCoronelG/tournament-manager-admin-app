import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { TranslocoPipe } from "@jsverse/transloco";
import { TournamentStatus } from "../tournament.model";

const CLASSES: Record<TournamentStatus, string> = {
  planning: "bg-amber-500/10 text-amber-800 dark:text-amber-400",
  in_progress: "bg-green-600/10 text-green-800 dark:text-green-400",
  playoffs: "bg-violet-600/10 text-violet-800 dark:text-violet-400",
  finished: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

@Component({
  selector: "app-tournament-status-chip",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `<span
    [class]="classes()"
    class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
    >{{ "tournaments.status." + status() | transloco }}</span
  >`,
})
export class TournamentStatusChipComponent {
  readonly status = input.required<TournamentStatus>();

  readonly classes = computed(() => CLASSES[this.status()]);
}
