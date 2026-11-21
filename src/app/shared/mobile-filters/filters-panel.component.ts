import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { TranslocoPipe } from "@jsverse/transloco";

/**
 * The panel that unfolds under the search row on phones: the filter fields
 * (projected, one below the other) and a "Clear" button.
 */
@Component({
  selector: "app-filters-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "flex flex-col mb-2" },
  imports: [MatButtonModule, TranslocoPipe],
  template: `
    <ng-content />
    <div class="flex justify-end -mt-2 mb-2">
      <button
        (click)="cleared.emit()"
        [disabled]="!canClear()"
        mat-button
        type="button"
      >
        {{ clearKey() | transloco }}
      </button>
    </div>
  `,
})
export class FiltersPanelComponent {
  /** Whether there is any filter to clear */
  readonly canClear = input.required<boolean>();
  /** i18n key of "Clear" */
  readonly clearKey = input.required<string>();
  readonly cleared = output();
}
