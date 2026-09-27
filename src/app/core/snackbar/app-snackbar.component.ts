import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import {
  MAT_SNACK_BAR_DATA,
  MatSnackBarRef,
} from "@angular/material/snack-bar";
import { SnackbarData } from "./snackbar-data.interface";
import { SnackbarVariant } from "./snackbar-variant.type";

const ICON_BY_VARIANT: Record<SnackbarVariant, string> = {
  success: "mat:check_circle",
  warning: "mat:warning",
  error: "mat:error",
  info: "mat:info",
};

@Component({
  selector: "app-snackbar",
  templateUrl: "./app-snackbar.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
})
export class AppSnackbarComponent {
  readonly data = inject<SnackbarData>(MAT_SNACK_BAR_DATA);
  private readonly snackBarRef =
    inject<MatSnackBarRef<AppSnackbarComponent>>(MatSnackBarRef);

  readonly icon = ICON_BY_VARIANT[this.data.variant];

  dismiss(): void {
    this.snackBarRef.dismissWithAction();
  }
}
