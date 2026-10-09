import {
  HttpClient,
  HttpContext,
  provideHttpClient,
  withInterceptors,
} from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { MatDialog } from "@angular/material/dialog";
import { provideRouter, Router } from "@angular/router";
import { AuthTokenService } from "../auth/auth-token.service";
import { CurrentUserService } from "../user/current-user.service";
import {
  KEEP_SESSION_ON_401,
  sessionExpiredInterceptor,
} from "./session-expired.interceptor";

describe("sessionExpiredInterceptor", () => {
  const closeAll = vi.fn();
  let http: HttpClient;
  let controller: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    closeAll.mockReset();
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionExpiredInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MatDialog, useValue: { closeAll } },
      ],
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    navigateByUrl = vi
      .spyOn(TestBed.inject(Router), "navigateByUrl")
      .mockResolvedValue(true);

    TestBed.inject(AuthTokenService).setToken("token-123");
    TestBed.inject(CurrentUserService).setUser({
      id: 5,
      name: "Ada",
      role: "",
      roles: ["league_admin"],
      avatarUrl: null,
    });
    localStorage.setItem("app.active-league.5", "3");
  });

  afterEach(() => {
    controller.verify();
    localStorage.clear();
  });

  const unauthorized = { status: 401, statusText: "Unauthorized" };

  it("ends the session, forgets the league and goes to the login on a 401", () => {
    const onError = vi.fn();

    http.get("/x").subscribe({ error: onError });
    controller
      .expectOne("/x")
      .flush({ error: "No autenticado." }, unauthorized);

    expect(TestBed.inject(AuthTokenService).token()).toBeNull();
    expect(localStorage.getItem("app.auth.token")).toBeNull();
    expect(TestBed.inject(CurrentUserService).user().id).toBe(0);
    expect(localStorage.getItem("app.active-league.5")).toBeNull();
    expect(closeAll).toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith("/");
    expect(onError).toHaveBeenCalledOnce();
  });

  it("leaves the session alone on other errors", () => {
    http.get("/x").subscribe({ error: vi.fn() });
    controller
      .expectOne("/x")
      .flush("", { status: 403, statusText: "Forbidden" });

    expect(TestBed.inject(AuthTokenService).token()).toBe("token-123");
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it("keeps the session when the request says its 401 is a normal answer", () => {
    http
      .put(
        "/user/password",
        {},
        {
          context: new HttpContext().set(KEEP_SESSION_ON_401, true),
        },
      )
      .subscribe({ error: vi.fn() });
    controller.expectOne("/user/password").flush("", unauthorized);

    expect(TestBed.inject(AuthTokenService).token()).toBe("token-123");
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it("does nothing when there was no session to end", () => {
    TestBed.inject(AuthTokenService).clear();

    http.get("/x").subscribe({ error: vi.fn() });
    controller.expectOne("/x").flush("", unauthorized);

    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it("only ends the session once when several requests fail together", () => {
    http.get("/a").subscribe({ error: vi.fn() });
    http.get("/b").subscribe({ error: vi.fn() });
    controller.expectOne("/a").flush("", unauthorized);
    controller.expectOne("/b").flush("", unauthorized);

    expect(navigateByUrl).toHaveBeenCalledTimes(1);
  });
});
