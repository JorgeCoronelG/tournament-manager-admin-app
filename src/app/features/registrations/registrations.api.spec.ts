import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { RegistrationsQuery } from "./registration.model";
import { RegistrationsApi } from "./registrations.api";

const query: RegistrationsQuery = {
  page: 1,
  pageSize: 10,
  search: "halcones",
  sort: "-created_at",
};

describe("RegistrationsApi", () => {
  let api: RegistrationsApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LeagueContextService,
          useValue: { leagueApi: (path: string) => `/api/leagues/3${path}` },
        },
      ],
    });

    api = TestBed.inject(RegistrationsApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("waits while no tournament is picked", () => {
    TestBed.runInInjectionContext(() =>
      api.list(signal(undefined), signal(query)),
    );
    TestBed.tick();

    controller.expectNone(() => true);
  });

  it("lists every enrolled team by name without paging", () => {
    TestBed.runInInjectionContext(() => api.all(signal(8)));
    TestBed.tick();

    const { params } = controller.expectOne(
      (r) => r.url === "/api/leagues/3/tournaments/8/registrations",
    ).request;
    expect(params.get("skip_paging")).toBe("true");
    expect(params.get("sort")).toBe("name");
    expect(params.has("per_page")).toBe(false);
    expect(params.has("page")).toBe(false);
  });

  it("waits to list every team until a tournament is picked", () => {
    TestBed.runInInjectionContext(() => api.all(signal(undefined)));
    TestBed.tick();

    controller.expectNone(() => true);
  });

  it("lists the enrolled teams of the tournament with the page, search and order", () => {
    TestBed.runInInjectionContext(() => api.list(signal(8), signal(query)));
    TestBed.tick();

    const { params } = controller.expectOne(
      (r) => r.url === "/api/leagues/3/tournaments/8/registrations",
    ).request;
    expect(params.get("page")).toBe("2");
    expect(params.get("per_page")).toBe("10");
    expect(params.get("search")).toBe("halcones");
    expect(params.get("sort")).toBe("-created_at");
  });

  it("enrolls the teams with team_ids and handles the errors itself", () => {
    api.register(8, [1, 2]).subscribe();

    const request = controller.expectOne(
      "/api/leagues/3/tournaments/8/registrations",
    );
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual({ team_ids: [1, 2] });
    expect(request.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
  });

  it("removes one registration from the tournament", () => {
    api.remove(8, 5).subscribe();

    const request = controller.expectOne(
      "/api/leagues/3/tournaments/8/registrations/5",
    );
    expect(request.request.method).toBe("DELETE");
  });

  it("withdraws a team with the trimmed reason and handles the errors itself", () => {
    api.withdraw(8, 5, "  No se presentó  ").subscribe();

    const request = controller.expectOne(
      "/api/leagues/3/tournaments/8/registrations/5/withdraw",
    );
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual({ reason: "No se presentó" });
    expect(request.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
  });

  it("replaces a team with the new team and the reason", () => {
    api.replace(8, 5, 12, "Se retiró").subscribe();

    const request = controller.expectOne(
      "/api/leagues/3/tournaments/8/registrations/5/replace",
    );
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual({ team_id: 12, reason: "Se retiró" });
    expect(request.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
  });
});
