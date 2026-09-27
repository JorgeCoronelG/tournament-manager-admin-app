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
import { TestBed } from "@angular/core/testing";
import { provideTestI18n } from "../../../testing/i18n";
import { SnackbarService } from "../snackbar/snackbar.service";
import {
  errorInterceptor,
  errorMessageKey,
  SKIP_ERROR_NOTIFICATION,
} from "./error.interceptor";

describe("errorInterceptor", () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let error: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    error = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideTestI18n(),
        { provide: SnackbarService, useValue: { error } },
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
});
