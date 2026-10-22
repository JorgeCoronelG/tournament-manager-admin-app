import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { RostersQuery } from "./roster.model";
import { RostersApi } from "./rosters.api";

const query: RostersQuery = {
  page: 1,
  pageSize: 10,
  sort: "",
  search: "ana",
  status: "active",
};

const base = "/api/leagues/3/tournaments/8/registrations/5/roster";

describe("RostersApi", () => {
  let api: RostersApi;
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

    api = TestBed.inject(RostersApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("waits while no tournament or team is picked", () => {
    TestBed.runInInjectionContext(() => {
      api.list(signal(8), signal(undefined), signal(query));
      api.list(signal(undefined), signal(5), signal(query));
    });
    TestBed.tick();

    controller.expectNone(() => true);
  });

  it("reads a page of the roster with its search and status", () => {
    TestBed.runInInjectionContext(() =>
      api.list(signal(8), signal(5), signal(query)),
    );
    TestBed.tick();

    const { params } = controller.expectOne((r) => r.url === base).request;
    expect(params.get("page")).toBe("2");
    expect(params.get("per_page")).toBe("10");
    expect(params.get("search")).toBe("ana");
    expect(params.get("status")).toBe("active");
    expect(params.has("sort")).toBe(false);
  });

  it("sends no search or status when they are empty", () => {
    TestBed.runInInjectionContext(() =>
      api.list(
        signal(8),
        signal(5),
        signal({ ...query, search: "", status: "" }),
      ),
    );
    TestBed.tick();

    const { params } = controller.expectOne((r) => r.url === base).request;
    expect(params.has("search")).toBe(false);
    expect(params.has("status")).toBe(false);
  });

  it("removes a player with a trimmed reason, reporting errors itself", () => {
    api.remove(8, 5, 11, "  Falta grave ").subscribe();

    const request = controller.expectOne(`${base}/11/remove`).request;
    expect(request.method).toBe("PATCH");
    expect(request.body).toEqual({ removal_reason: "Falta grave" });
    expect(request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
  });

  it("authorizes and revokes a rejoin", () => {
    api.authorizeRejoin(8, 5, 11).subscribe();
    api.revokeRejoin(8, 5, 11).subscribe();

    const requests = controller.match(`${base}/11/rejoin`);
    expect(requests.map((r) => r.request.method)).toEqual(["POST", "DELETE"]);
  });
});
