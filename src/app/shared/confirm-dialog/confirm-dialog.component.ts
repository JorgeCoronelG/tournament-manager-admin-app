import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule } from "@angular/material/dialog";
import { TranslocoPipe } from "@jsverse/transloco";

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel: string;
  /** `danger` (default, red) for destructive actions; `primary` for the rest */
  tone?: "danger" | "primary";
  /** Cancel button with an outline instead of plain text */
  cancelOutlined?: boolean;
}

/** Closes with `true` when confirmed, `undefined` otherwise */
@Component({
  selector: "app-confirm-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, TranslocoPipe],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content
      [innerHTML]="data.message"
      class="whitespace-pre-line"
    />
    <mat-dialog-actions align="end">
      @if (data.cancelOutlined) {
        <button mat-stroked-button mat-dialog-close type="button">
          {{ "common.cancel" | transloco }}
        </button>
      } @else {
        <button mat-button mat-dialog-close type="button">
          {{ "common.cancel" | transloco }}
        </button>
      }
      <button
        [color]="data.tone === 'primary' ? undefined : 'warn'"
        [mat-dialog-close]="true"
        mat-flat-button
        type="button"
      >
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
