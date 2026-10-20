import {
  email,
  maxLength,
  minLength,
  pattern,
  required,
  SchemaPathTree,
  ValidationError,
} from "@angular/forms/signals";
import { TranslocoService } from "@jsverse/transloco";
import {
  NAME_MAX,
  NAME_MIN,
  PHONE_PATTERN,
  USER_CODE_MAX,
} from "../referees/referee-form";
import { ManagerInput } from "./team.model";

export { NAME_MAX, NAME_MIN, USER_CODE_MAX };

/** How the delegate is given: nobody yet, a new user, or an existing one by code */
export type ManagerMode = "none" | "new" | "code";

/** The delegate part of a form (the dialogs add their own fields beside it) */
export interface ManagerModel {
  mode: ManagerMode;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  user_code: string;
}

export const emptyManager = (mode: ManagerMode): ManagerModel => ({
  mode,
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  user_code: "",
});

/** Rules of the fields of the chosen mode only; the others are not sent */
export function applyManagerRules(path: SchemaPathTree<ManagerModel>): void {
  const isNew = ({ valueOf }: { valueOf: (p: typeof path.mode) => string }) =>
    valueOf(path.mode) === "new";
  const isCode = ({ valueOf }: { valueOf: (p: typeof path.mode) => string }) =>
    valueOf(path.mode) === "code";

  for (const name of [path.first_name, path.last_name]) {
    required(name, { when: isNew });
    minLength(name, NAME_MIN, { when: isNew });
    maxLength(name, NAME_MAX, { when: isNew });
  }

  required(path.email, { when: isNew });
  email(path.email, { when: isNew });
  // Mexican numbers: exactly 10 digits (optional)
  maxLength(path.phone, 10, { when: isNew });
  pattern(path.phone, PHONE_PATTERN, { when: isNew });

  required(path.user_code, { when: isCode });
  maxLength(path.user_code, USER_CODE_MAX, { when: isCode });
}

/** What goes to the backend for the chosen mode; undefined for "none" */
export function managerInput(model: ManagerModel): ManagerInput | undefined {
  if (model.mode === "new") {
    return {
      first_name: model.first_name.trim(),
      last_name: model.last_name.trim(),
      email: model.email.trim(),
      phone: model.phone.trim() || null,
    };
  }

  return model.mode === "code"
    ? { user_code: model.user_code.trim().toUpperCase() }
    : undefined;
}

/** Text of the first failed rule of a delegate field */
export function managerErrorText(
  transloco: TranslocoService,
  errors: readonly ValidationError[],
  value: unknown,
  max = NAME_MAX,
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
    return transloco.translate(`validation.${kind}`, { min: NAME_MIN, max });
  }

  return kind === "pattern"
    ? transloco.translate("validation.phone")
    : transloco.translate("validation.required");
}
