import { inject, Service } from "@angular/core";
import { FieldTree, submit } from "@angular/forms/signals";
import { firstValueFrom, Observable } from "rxjs";
import { fieldErrors } from "../../core/http/api-errors";
import { SnackbarService } from "../../core/snackbar/snackbar.service";

export interface FormSubmitOptions<R> {
  /** The request that sends the form's values; read them here, at submit time */
  send: () => Observable<R>;
  /** Runs after a successful response (close the dialog, navigate...) */
  onSuccess?: (result: R) => void | Promise<void>;
  /**
   * Who reports a failure:
   * - `"interceptor"` (default): the error interceptor already told the user.
   * - `"form"`: the request skips the interceptor (`SKIP_ERROR_NOTIFICATION`).
   *   A 422's field errors go to their fields, the rest to a snackbar.
   */
  errors?: "interceptor" | "form";
  /**
   * Fields whose 422 errors the caller handles itself (e.g. a rule that spans
   * several fields and must clear when any of them changes). Only with `"form"`.
   */
  ignoreFields?: readonly string[];
  /**
   * Where the failures that belong to no field go (a 422 with a plain message,
   * any other error) instead of the snackbar, e.g. an alert inside the dialog.
   * Only with `"form"`.
   */
  onFormError?: (message: string) => void;
}

/**
 * Submits a Signal Form: runs the request only if the form is valid, keeps the
 * form's `submitting()` on while it runs and reports failures. Use
 * `form().submitting()` to disable the submit button.
 */
@Service()
export class FormSubmitService {
  private readonly snackbar = inject(SnackbarService);

  submit<TModel, R>(
    form: FieldTree<TModel>,
    {
      send,
      onSuccess,
      errors = "interceptor",
      ignoreFields = [],
      onFormError,
    }: FormSubmitOptions<R>,
  ): Promise<boolean> {
    return submit(form, async () => {
      try {
        const result = await firstValueFrom(send());
        await onSuccess?.(result);

        return undefined;
      } catch (error) {
        return errors === "form"
          ? this.report(form, error, ignoreFields, onFormError)
          : undefined;
      }
    });
  }

  /** Field errors from a 422 onto the form's fields; anything else in a snackbar (or `onFormError`) */
  private report<TModel>(
    form: FieldTree<TModel>,
    error: unknown,
    ignoreFields: readonly string[],
    onFormError?: (message: string) => void,
  ) {
    const show = (message: string) =>
      onFormError ? onFormError(message) : this.snackbar.error(message);
    const all = fieldErrors(error);

    if (!all) {
      if (onFormError) {
        onFormError(this.snackbar.failureText(error));
      } else {
        this.snackbar.notifyFailure(error);
      }

      return undefined;
    }

    const serverErrors = Object.fromEntries(
      Object.entries(all).filter(([field]) => !ignoreFields.includes(field)),
    );

    const fields = new Set(Object.keys(form().value() as object));
    const tree = form as unknown as Record<string, FieldTree<unknown>>;

    // Anything the form has no field for is still shown
    const unmatched = Object.entries(serverErrors)
      .filter(([field]) => !fields.has(field))
      .flatMap(([, messages]) => messages);

    if (unmatched.length) {
      show(unmatched.join(" "));
    }

    return Object.entries(serverErrors)
      .filter(([field]) => fields.has(field))
      .map(([field, messages]) => ({
        kind: "server",
        message: messages.join(" "),
        fieldTree: tree[field],
      }));
  }
}
