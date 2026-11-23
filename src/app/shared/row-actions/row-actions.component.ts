import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { TranslocoPipe } from "@jsverse/transloco";

export interface RowAction {
  /** Name of the `mat:` icon */
  icon: string;
  /** i18n key of the label */
  labelKey: string;
  run: () => void;
  /** Destructive actions (delete) are painted with the error color */
  danger?: boolean;
  /** Draws a divider before this action, to set a group of actions apart */
  divider?: boolean;
}

/** The "⋮" button of a table row on phones: a menu with the row's actions */
@Component({
  selector: "app-row-actions",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    TranslocoPipe,
  ],
  template: `
    <button
      [attr.aria-label]="labelKey() | transloco"
      [matMenuTriggerFor]="menu"
      class="app-touch-target"
      mat-icon-button
      type="button"
    >
      <mat-icon svgIcon="mat:more_vert" />
    </button>

    <mat-menu #menu="matMenu">
      @for (action of actions(); track action.labelKey) {
        @if (action.divider && !$first) {
          <mat-divider />
        }
        <button
          (click)="action.run()"
          [class.app-action-danger-item]="action.danger"
          mat-menu-item
          type="button"
        >
          <mat-icon [svgIcon]="action.icon" />
          <span>{{ action.labelKey | transloco }}</span>
        </button>
      }
    </mat-menu>
  `,
})
export class RowActionsComponent {
  readonly actions = input.required<RowAction[]>();
  /** i18n key of the button's label ("Actions") */
  readonly labelKey = input.required<string>();
}
