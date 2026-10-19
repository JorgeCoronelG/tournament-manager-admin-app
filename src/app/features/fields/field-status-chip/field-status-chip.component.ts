import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { TranslocoPipe } from "@jsverse/transloco";
import { FieldStatus } from "../field.model";

const CLASSES: Record<FieldStatus, string> = {
  active: "bg-green-600/10 text-green-800 dark:text-green-400",
  inactive: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

/** Whether the field can be used */
@Component({
  selector: "app-field-status-chip",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `<span
    [class]="classes()"
    class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
    >{{ "fields.status." + status() | transloco }}</span
  >`,
})
export class FieldStatusChipComponent {
  readonly status = input.required<FieldStatus>();

  readonly classes = computed(() => CLASSES[this.status()]);
}
