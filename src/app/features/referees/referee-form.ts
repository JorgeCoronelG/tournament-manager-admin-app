import { ValidationError } from "@angular/forms/signals";
import { TranslocoService } from "@jsverse/transloco";

export const NAME_MIN = 3;
export const NAME_MAX = 100;
export const PHONE_PATTERN = /^\d{10}$/;

/** Text of the first failed rule of a referee field (shared by the referee dialogs) */
export function refereeErrorText(
  transloco: TranslocoService,
  errors: readonly ValidationError[],
  value: unknown,
): string {
  const message = errors.find((error) => error.message)?.message;

  if (message) {
    return message;
  }

  const kind = errors[0]?.kind;

  if (kind === "email" && value) {
    return transloco.translate("validation.email");
  }

  if (kind === "minLength" || kind === "maxLength") {
    return transloco.translate(`validation.${kind}`, {
      min: NAME_MIN,
      max: NAME_MAX,
    });
  }

  if (kind === "pattern") {
    return transloco.translate("validation.phone");
  }

  return transloco.translate("validation.required");
}
