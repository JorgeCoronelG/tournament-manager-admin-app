import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { TranslocoPipe } from "@jsverse/transloco";
import { UserStatus } from "../user.model";

const CLASSES: Record<UserStatus, string> = {
  active: "bg-green-600/10 text-green-800 dark:text-green-400",
  pending: "bg-amber-500/10 text-amber-800 dark:text-amber-400",
  inactive: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

@Component({
  selector: "app-user-status-chip",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `<span
    [class]="classes()"
    class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
    >{{ "users.status." + status() | transloco }}</span
  >`,
})
export class UserStatusChipComponent {
  readonly status = input.required<UserStatus>();

  readonly classes = computed(() => CLASSES[this.status()]);
}
