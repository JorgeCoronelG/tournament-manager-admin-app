import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { MatDialog } from "@angular/material/dialog";
import { TestBed } from "@angular/core/testing";
import { provideTestI18n } from "../../../testing/i18n";
import { SnackbarService } from "../snackbar/snackbar.service";
import {
  errorInterceptor,
  errorMessageKey,
  SKIP_ERROR_NOTIFICATION,
  validationErrors,
  backendMessage,
} from "./error.interceptor";
import { ValidationErrorsDialogComponent } from "./validation-errors-dialog/validation-errors-dialog.component";

describe("errorInterceptor", () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let error: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    error = vi.fn();
    open = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideTestI18n(),
        { provide: SnackbarService, useValue: { error } },
        { provide: MatDialog, useValue: { open } },
      ],
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("shows a translated snackbar and rethrows the error", () => {
    const onError = vi.fn();

    http.get("/x").subscribe({ error: onError });
    controller.expectOne("/x").flush("", { status: 500, statusText: "Error" });

    expect(error).toHaveBeenCalledWith(
      "El servidor tuvo un problema. Inténtalo más tarde.",
      "Aceptar",
    );
    expect(onError).toHaveBeenCalledOnce();
  });

  it("stays silent when the request opts out", () => {
    http
      .get("/x", {
        context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
      })
      .subscribe({ error: () => undefined });
    controller.expectOne("/x").flush("", { status: 500, statusText: "Error" });

    expect(error).not.toHaveBeenCalled();
  });

  it("does not interfere with successful responses", () => {
    http.get("/x").subscribe();
    controller.expectOne("/x").flush({});

    expect(error).not.toHaveBeenCalled();
  });

  it("maps status codes to message keys", () => {
    const key = (status: number) =>
      errorMessageKey(new HttpErrorResponse({ status }));

    expect(key(0)).toBe("errors.network");
    expect(key(401)).toBe("errors.forbidden");
    expect(key(403)).toBe("errors.forbidden");
    expect(key(404)).toBe("errors.notFound");
    expect(key(503)).toBe("errors.server");
    expect(key(422)).toBe("errors.generic");
  });

  it("opens the validation errors dialog on a 422 with field errors", () => {
    http.post("/x", {}).subscribe({ error: () => undefined });
    controller.expectOne("/x").flush(
      {
        code: 422,
        error: {
          email: ["El correo es obligatorio."],
          name: ["El nombre es obligatorio.", "El nombre es muy corto."],
        },
      },
      { status: 422, statusText: "Unprocessable Entity" },
    );

    expect(open).toHaveBeenCalledWith(ValidationErrorsDialogComponent, {
      data: [
        "El correo es obligatorio.",
        "El nombre es obligatorio.",
        "El nombre es muy corto.",
      ],
    });
    expect(error).not.toHaveBeenCalled();
  });

  it("shows the message in a snackbar on a 422 without field errors", () => {
    http.post("/x", {}).subscribe({ error: () => undefined });
    controller
      .expectOne("/x")
      .flush(
        { code: 422, error: "Código inválido o expirado." },
        { status: 422, statusText: "Unprocessable Entity" },
      );

    expect(open).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      "Código inválido o expirado.",
      "Aceptar",
    );
  });

  it("shows the backend's business message when there is one", () => {
    http.post("/x", {}).subscribe({ error: () => undefined });
    controller
      .expectOne("/x")
      .flush(
        { code: 401, error: "Contraseña actual incorrecta." },
        { status: 401, statusText: "Unauthorized" },
      );

    expect(error).toHaveBeenCalledWith(
      "Contraseña actual incorrecta.",
      "Aceptar",
    );
    expect(backendMessage(new HttpErrorResponse({ status: 500 }))).toBeNull();
  });

  it("extracts and flattens the field errors from a 422 response", () => {
    const extracted = validationErrors(
      new HttpErrorResponse({
        status: 422,
        error: {
          code: 422,
          error: { email: ["required"], name: ["required"] },
        },
      }),
    );

    expect(extracted).toEqual(["required", "required"]);
    expect(validationErrors(new HttpErrorResponse({ status: 401 }))).toBeNull();
    expect(
      validationErrors(
        new HttpErrorResponse({ status: 422, error: { error: "message" } }),
      ),
    ).toBeNull();
  });
});
