import { HttpErrorResponse } from "@angular/common/http";

/** Translation key of the generic message for a failed request, by status */
export function errorMessageKey(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return "errors.network";
  }

  if (error.status === 401 || error.status === 403) {
    return "errors.forbidden";
  }

  if (error.status === 404) {
    return "errors.notFound";
  }

  return error.status >= 500 ? "errors.server" : "errors.generic";
}

/** The plain-text `error` the backend sends on business errors (e.g. "Código inválido o expirado.") */
export function backendMessage(error: HttpErrorResponse): string | null {
  const body: unknown = error.error;
  const message =
    body && typeof body === "object"
      ? (body as { error?: unknown }).error
      : null;

  return typeof message === "string" && message ? message : null;
}

/** `{ field: [messages] }` from a 422 (`{ code, error: {...} }`), or null for any other error */
export function fieldErrors(
  error: unknown,
): Record<string, readonly string[]> | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 422) {
    return null;
  }

  const body: unknown = error.error;
  const errors =
    body && typeof body === "object"
      ? (body as { error?: unknown }).error
      : null;

  if (!errors || typeof errors !== "object" || Array.isArray(errors)) {
    return null;
  }

  const result: Record<string, readonly string[]> = {};

  for (const [field, value] of Object.entries(errors)) {
    const messages = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];

    if (messages.length) {
      result[field] = messages;
    }
  }

  return Object.keys(result).length ? result : null;
}

/** Message to show in a snackbar for a failed request: the backend's own, or a generic one */
export function failureMessage(
  error: unknown,
  translate: (key: string) => string,
): string {
  return error instanceof HttpErrorResponse
    ? (backendMessage(error) ?? translate(errorMessageKey(error)))
    : translate("errors.generic");
}
