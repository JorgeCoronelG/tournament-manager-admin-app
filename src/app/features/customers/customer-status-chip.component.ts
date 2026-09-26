import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { TranslocoPipe } from "@jsverse/transloco";
import { CustomerStatus } from "./customer.model";

@Component({
  selector: "app-customer-status-chip",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `<span
    [class]="classes()"
    class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
    >{{ "customers.status." + status() | transloco }}</span
  >`,
})
export class CustomerStatusChipComponent {
  readonly status = input.required<CustomerStatus>();

  readonly classes = computed(() =>
    this.status() === "active"
      ? "bg-green-600/10 text-green-800 dark:text-green-400"
      : "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  );
}
