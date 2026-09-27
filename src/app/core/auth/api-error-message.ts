import { HttpErrorResponse } from "@angular/common/http";

/** Reads the human-readable `error` field the backend sends on business errors (e.g. invalid code) */
export function apiErrorMessage(error: unknown): string | null {
  return error instanceof HttpErrorResponse &&
    typeof error.error?.error === "string"
    ? error.error.error
    : null;
}
