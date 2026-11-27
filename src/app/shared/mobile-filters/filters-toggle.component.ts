import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from "@angular/core";
import { MatBadgeModule } from "@angular/material/badge";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { TranslocoPipe } from "@jsverse/transloco";

/**
 * The "Filters" button of a list on phones: a funnel with a badge of the
 * filters in use. It folds and unfolds the panel (`open`). Sits in a row next
 * to the search field, hence the top margin that centers it on the field.
 */
@Component({
  selector: "app-filters-toggle",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "block flex-none mt-1.5" },
  imports: [MatBadgeModule, MatButtonModule, MatIconModule, TranslocoPipe],
  template: `
    <button
      (click)="open.set(!open())"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="
        (titleKey() | transloco) +
        (count() ? ', ' + (activeKey() | transloco: { count: count() }) : '')
      "
      [matBadge]="count()"
      [matBadgeHidden]="!count()"
      class="app-touch-target"
      mat-icon-button
      matBadgeSize="small"
      type="button"
    >
      <mat-icon svgIcon="mat:filter_list" />
    </button>
  `,
})
export class FiltersToggleComponent {
  /** Filters in use */
  readonly count = input.required<number>();
  /** Whether the panel is unfolded */
  readonly open = model.required<boolean>();
  /** i18n keys of "Filters" and "{{count}} active" */
  readonly titleKey = input.required<string>();
  readonly activeKey = input.required<string>();
}
