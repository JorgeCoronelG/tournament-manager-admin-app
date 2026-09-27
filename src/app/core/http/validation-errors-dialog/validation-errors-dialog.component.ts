import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { TranslocoPipe } from "@jsverse/transloco";

@Component({
  selector: "app-validation-errors-dialog",
  templateUrl: "./validation-errors-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, TranslocoPipe],
})
export class ValidationErrorsDialogComponent {
  readonly messages = inject<string[]>(MAT_DIALOG_DATA);
}
