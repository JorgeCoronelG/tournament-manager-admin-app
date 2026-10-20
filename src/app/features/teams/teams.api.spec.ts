import { HttpErrorResponse, provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ApplicationRef, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { PaginatedResponse } from "../../core/http/paginated-response.model";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { Team, TeamsQuery } from "./team.model";
import { TeamsApi } from "./teams.api";

const team = (id: number): Team => ({
  id,
  name: `Equipo ${id}`,
  logo_url: null,
  status: "active",
  manager: null,
  created_at: "2026-01-01T00:00:00.000Z",
});

const page = (rows: Team[], total: number): PaginatedResponse<Team> => ({
  data: rows,
  links: { first: null, last: "x?page=9", prev: null, next: "x?page=2" },
  meta: {
    currentPage: 1,
    from: 1,
    lastPage: 9,
    perPage: 5,
    to: rows.length,
    total,
  },
});

const emptyQuery = (): TeamsQuery => ({
  page: 0,
  pageSize: 5,
  search: "",
  status: "",
  manager: "",
  sort: "",
});

describe("TeamsApi", () => {
  let api: TeamsApi;
  let controller: HttpTestingController;
  const leagueId = signal<number | null>(3);

  beforeEach(() => {
    leagueId.set(3);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LeagueContextService,
          useValue: {
            leagueApi: (path: string) =>
              leagueId() === null
                ? undefined
                : `/api/leagues/${leagueId()}${path}`,
          },
        },
      ],
    });

    api = TestBed.inject(TeamsApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("requests the active league's teams with snake_case params, converting the page and reading the total", async () => {
    const query = signal<TeamsQuery>({
      ...emptyQuery(),
      page: 1,
      pageSize: 10,
      search: "tigres",
      status: "banned",
      manager: "none",
      sort: "-name",
    });

    const { rows, total } = TestBed.runInInjectionContext(() =>
      api.list(query),
    );
    TestBed.tick();

    const request = controller.expectOne(
      (r) => r.url === "/api/leagues/3/teams",
    );
    const { params } = request.request;
    expect(params.get("page")).toBe("2");
    expect(params.get("per_page")).toBe("10");
    expect(params.get("search")).toBe("tigres");
    expect(params.get("status")).toBe("banned");
    expect(params.get("has_manager")).toBe("false");
    expect(params.get("sort")).toBe("-name");

    request.flush(page([team(1), team(2)], 42));
    await TestBed.inject(ApplicationRef).whenStable();

    expect(rows()).toHaveLength(2);
    expect(total()).toBe(42);
  });

  it("filters by the chosen delegate and loads the delegates of the league", () => {
    TestBed.runInInjectionContext(() =>
      api.list(signal({ ...emptyQuery(), manager: 7 })),
    );
    TestBed.runInInjectionContext(() => api.managers());
    TestBed.tick();

    expect(
      controller
        .expectOne((r) => r.url === "/api/leagues/3/teams")
        .request.params.get("manager_user_id"),
    ).toBe("7");
    controller.expectOne("/api/leagues/3/teams/managers");
  });

  it("omits empty params", () => {
    TestBed.runInInjectionContext(() => api.list(signal(emptyQuery())));
    TestBed.tick();

    const { params } = controller.expectOne((r) =>
      r.url.endsWith("/teams"),
    ).request;
    expect(params.keys().sort()).toEqual(["page", "per_page"]);
  });

  it("waits without a league", () => {
    leagueId.set(null);
    TestBed.runInInjectionContext(() => api.list(signal(emptyQuery())));
    TestBed.tick();

    controller.expectNone((r) => r.url.endsWith("/teams"));
  });

  it("looks a delegate up by code, waiting while the code is empty", () => {
    const code = signal("");
    TestBed.runInInjectionContext(() => api.lookupManager(code));
    TestBed.tick();
    controller.expectNone((r) => r.url.endsWith("/manager-lookup"));

    code.set("ABC123");
    TestBed.tick();

    const request = controller.expectOne(
      (r) => r.url === "/api/leagues/3/teams/manager-lookup",
    );
    expect(request.request.params.get("user_code")).toBe("ABC123");
    expect(request.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    request.flush({});
  });

  it("writes under the league's id", () => {
    const expectCall = (url: string, method: string, body?: unknown) => {
      const request = controller.expectOne(url);
      expect(request.request.method).toBe(method);

      if (body !== undefined) {
        expect(request.request.body).toEqual(body);
      }

      request.flush(null, { status: 200, statusText: "OK" });
    };

    api.create({ name: "Tigres" }).subscribe();
    expectCall("/api/leagues/3/teams", "POST", { name: "Tigres" });

    api.create({ name: "Tigres", manager: { user_code: "ABC" } }).subscribe();
    expectCall("/api/leagues/3/teams", "POST", {
      name: "Tigres",
      manager_user_code: "ABC",
    });

    api.update(5, { name: "Leones" }).subscribe();
    expectCall("/api/leagues/3/teams/5", "PUT", { name: "Leones" });

    api.setStatus(5, "banned").subscribe();
    expectCall("/api/leagues/3/teams/5/status", "PATCH", { status: "banned" });

    api.remove(5).subscribe();
    expectCall("/api/leagues/3/teams/5", "DELETE");

    api.setManager(5, { user_code: "ABC" }).subscribe();
    expectCall("/api/leagues/3/teams/5/manager", "PUT", {
      manager_user_code: "ABC",
    });

    const manager = {
      first_name: "Ana",
      last_name: "Pérez",
      email: "ana@example.com",
      phone: null,
    };
    api.updateManager(5, manager).subscribe();
    expectCall("/api/leagues/3/teams/5/manager", "PATCH", manager);

    api.removeManager(5).subscribe();
    expectCall("/api/leagues/3/teams/5/manager", "DELETE");

    api.resendInvitation(5).subscribe();
    expectCall("/api/leagues/3/teams/5/manager/resend-invitation", "POST", {});

    api.removeLogo(5).subscribe();
    expectCall("/api/leagues/3/teams/5/logo", "DELETE");
  });

  it("uploads the logo as FormData in the 'logo' field, leaving the Content-Type to the browser", () => {
    const file = new File(["x"], "logo.png", { type: "image/png" });

    api.uploadLogo(5, file).subscribe();

    const request = controller.expectOne("/api/leagues/3/teams/5/logo");
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get("logo")).toBe(file);
    expect(request.request.headers.has("Content-Type")).toBe(false);
    request.flush({});
  });

  it("skips the generic error notification on writes", () => {
    api.create({ name: "Tigres" }).subscribe({ error: () => undefined });

    const request = controller.expectOne("/api/leagues/3/teams");
    expect(request.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    request.flush(null, { status: 422, statusText: "Unprocessable" });
  });

  it("drops the 'manager.' prefix of a 422 so errors reach the delegate's fields", () => {
    let error: HttpErrorResponse | undefined;
    api
      .create({ name: "Tigres", manager: { user_code: "x" } })
      .subscribe({ error: (e: HttpErrorResponse) => (error = e) });

    controller.expectOne("/api/leagues/3/teams").flush(
      {
        code: 422,
        error: {
          name: ["Repetido."],
          "manager.email": ["El correo ya existe."],
        },
      },
      { status: 422, statusText: "Unprocessable" },
    );

    expect(error?.status).toBe(422);
    expect(error?.error).toEqual({
      code: 422,
      error: { name: ["Repetido."], email: ["El correo ya existe."] },
    });
  });

  it("leaves other errors untouched", () => {
    let status = 0;
    api.setManager(1, { user_code: "x" }).subscribe({
      error: (e: HttpErrorResponse) => (status = e.status),
    });

    controller
      .expectOne("/api/leagues/3/teams/1/manager")
      .flush(null, { status: 500, statusText: "Server Error" });

    expect(status).toBe(500);
  });
});
