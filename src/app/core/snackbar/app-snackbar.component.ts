import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MAT_SNACK_BAR_DATA } from "@angular/material/snack-bar";
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
  imports: [MatIconModule],
})
export class AppSnackbarComponent {
  readonly data = inject<SnackbarData>(MAT_SNACK_BAR_DATA);

  readonly icon = ICON_BY_VARIANT[this.data.variant];
}
