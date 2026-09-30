import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule } from "@angular/material/dialog";
import { TranslocoPipe } from "@jsverse/transloco";

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel: string;
}

/** Closes with `true` when confirmed, `undefined` otherwise */
@Component({
  selector: "app-confirm-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, TranslocoPipe],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content class="whitespace-pre-line">{{
      data.message
    }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">
        {{ "common.cancel" | transloco }}
      </button>
      <button
        [mat-dialog-close]="true"
        color="warn"
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
