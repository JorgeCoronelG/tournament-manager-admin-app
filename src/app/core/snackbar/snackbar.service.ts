import { inject, Service } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TranslocoService } from "@jsverse/transloco";
import { failureMessage } from "../http/api-errors";
import { AppSnackbarComponent } from "./app-snackbar.component";
import { SnackbarVariant } from "./snackbar-variant.type";

const DURATION_MS = 5000;

/**
 * Shows system messages (mainly ones coming from the API) as a snackbar,
 * top-right, colored and with an icon that depends on the outcome. It has no
 * action button: it fades out by itself. See
 * `AppSnackbarComponent` and `@ui/styles/partials/plugins/@angular/material/_snack-bar.scss`
 * for the `app-snackbar--<variant>` colors.
 */
@Service()
export class SnackbarService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  success(message: string): void {
    this.show(message, "success");
  }

  warning(message: string): void {
    this.show(message, "warning");
  }

  error(message: string): void {
    this.show(message, "error");
  }

  info(message: string): void {
    this.show(message, "info");
  }

  /** Success message from a translation key */
  notifySuccess(key: string, params?: Record<string, unknown>): void {
    this.success(this.transloco.translate(key, params));
  }

  /** A failed request: the backend's own message, or a generic one for its status */
  notifyFailure(error: unknown): void {
    this.error(this.failureText(error));
  }

  /** The text `notifyFailure` shows, for places that show it themselves */
  failureText(error: unknown): string {
    return failureMessage(error, (key) => this.transloco.translate(key));
  }

  private show(message: string, variant: SnackbarVariant): void {
    this.snackBar.openFromComponent(AppSnackbarComponent, {
      data: { message, variant },
      duration: DURATION_MS,
      horizontalPosition: "end",
      verticalPosition: "top",
      panelClass: ["app-snackbar", `app-snackbar--${variant}`],
    });
  }
}
