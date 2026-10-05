import { inject, Service } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { TranslocoService } from "@jsverse/transloco";
import { failureMessage } from "../http/api-errors";
import { AppSnackbarComponent } from "./app-snackbar.component";
import { SnackbarVariant } from "./snackbar-variant.type";

const DURATION_MS = 5000;

/**
 * Shows system messages (mainly ones coming from the API) as a snackbar,
 * top-right, colored and with an icon that depends on the outcome. See
 * `AppSnackbarComponent` and `@ui/styles/partials/plugins/@angular/material/_snack-bar.scss`
 * for the `app-snackbar--<variant>` colors.
 */
@Service()
export class SnackbarService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  success(message: string, action?: string): void {
    this.show(message, "success", action);
  }

  warning(message: string, action?: string): void {
    this.show(message, "warning", action);
  }

  error(message: string, action?: string): void {
    this.show(message, "error", action);
  }

  info(message: string, action?: string): void {
    this.show(message, "info", action);
  }

  /** Success message from a translation key, with the "OK" action */
  notifySuccess(key: string): void {
    this.success(this.transloco.translate(key), this.okLabel());
  }

  /** A failed request: the backend's own message, or a generic one for its status */
  notifyFailure(error: unknown): void {
    this.error(
      failureMessage(error, (key) => this.transloco.translate(key)),
      this.okLabel(),
    );
  }

  private okLabel(): string {
    return this.transloco.translate("common.ok");
  }

  private show(
    message: string,
    variant: SnackbarVariant,
    action?: string,
  ): void {
    this.snackBar.openFromComponent(AppSnackbarComponent, {
      data: { message, variant, action },
      duration: DURATION_MS,
      horizontalPosition: "end",
      verticalPosition: "top",
      panelClass: ["app-snackbar", `app-snackbar--${variant}`],
    });
  }
}
