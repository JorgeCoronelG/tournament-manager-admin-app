import { HttpErrorResponse } from "@angular/common/http";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { form, required } from "@angular/forms/signals";
import { of, throwError } from "rxjs";
import { SnackbarService } from "../../core/snackbar/snackbar.service";
import { FormSubmitService } from "./form-submit.service";

describe("FormSubmitService", () => {
  const error = vi.fn();
  const notifyFailure = vi.fn();
  const send = vi.fn();
  const onSuccess = vi.fn();

  function setup(values = { name: "Ana", email: "ana@example.com" }) {
    const model = signal(values);

    return {
      service: TestBed.inject(FormSubmitService),
      userForm: TestBed.runInInjectionContext(() =>
        form(model, (path) => {
          required(path.name);
        }),
      ),
    };
  }

  const unprocessable = (body: unknown) =>
    throwError(
      () =>
        new HttpErrorResponse({
          status: 422,
          error: { code: 422, ...(body as object) },
        }),
    );

  beforeEach(() => {
    for (const fn of [error, notifyFailure, send, onSuccess]) {
      fn.mockReset();
    }
    send.mockReturnValue(of({ id: 1 }));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SnackbarService,
          useValue: {
            error,
            notifyFailure,
            failureText: (e: HttpErrorResponse) =>
              (e.error as { error?: string } | null)?.error ?? "generic",
          },
        },
      ],
    });
  });

  it("sends the form and hands the response to onSuccess", async () => {
    const { service, userForm } = setup();

    const ok = await service.submit(userForm, { send, onSuccess });

    expect(ok).toBe(true);
    expect(send).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledWith({ id: 1 });
    expect(userForm().submitting()).toBe(false);
  });

  it("does not send an invalid form", async () => {
    const { service, userForm } = setup({ name: "", email: "" });

    expect(await service.submit(userForm, { send, onSuccess })).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("leaves the failure to the error interceptor by default", async () => {
    send.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const { service, userForm } = setup();

    await service.submit(userForm, { send, onSuccess });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(notifyFailure).not.toHaveBeenCalled();
    expect(userForm().submitting()).toBe(false);
  });

  it("puts the 422 field errors on their fields and shows the rest in a snackbar", async () => {
    send.mockReturnValue(
      unprocessable({
        error: {
          email: ["El correo ya existe.", "Otro."],
          other: ["No es de este formulario."],
        },
      }),
    );
    const { service, userForm } = setup();

    await service.submit(userForm, { send, onSuccess, errors: "form" });

    expect(userForm.email().errors()).toEqual([
      expect.objectContaining({
        kind: "server",
        message: "El correo ya existe. Otro.",
      }),
    ]);
    expect(userForm.name().errors()).toEqual([]);
    expect(error).toHaveBeenCalledWith("No es de este formulario.");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows any other failure in a snackbar when the form handles errors", async () => {
    const failure = new HttpErrorResponse({ status: 500 });
    send.mockReturnValue(throwError(() => failure));
    const { service, userForm } = setup();

    await service.submit(userForm, { send, errors: "form" });

    expect(notifyFailure).toHaveBeenCalledWith(failure);
  });

  it("hands the failures that belong to no field to onFormError instead of the snackbar", async () => {
    const onFormError = vi.fn();
    const { service, userForm } = setup();

    send.mockReturnValue(unprocessable({ error: "Ya tiene ese equipo." }));
    await service.submit(userForm, { send, errors: "form", onFormError });
    expect(onFormError).toHaveBeenLastCalledWith("Ya tiene ese equipo.");

    send.mockReturnValue(unprocessable({ error: { other: ["Sin campo."] } }));
    await service.submit(userForm, { send, errors: "form", onFormError });
    expect(onFormError).toHaveBeenLastCalledWith("Sin campo.");

    expect(error).not.toHaveBeenCalled();
    expect(notifyFailure).not.toHaveBeenCalled();
  });
});
