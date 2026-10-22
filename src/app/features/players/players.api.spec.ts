import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { PlayersQuery } from "./player.model";
import { PlayersApi } from "./players.api";

const query: PlayersQuery = {
  page: 1,
  pageSize: 10,
  sort: "-name",
  search: "ana",
  gender: "female",
  status: "banned",
};

describe("PlayersApi", () => {
  let api: PlayersApi;
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

    api = TestBed.inject(PlayersApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("lists a page with the search, the gender and the ban filter", () => {
    TestBed.runInInjectionContext(() => api.list(signal(query)));
    TestBed.tick();

    const { params } = controller.expectOne(
      (r) => r.url === "/api/leagues/3/players",
    ).request;
    expect(params.get("page")).toBe("2");
    expect(params.get("per_page")).toBe("10");
    expect(params.get("sort")).toBe("-name");
    expect(params.get("search")).toBe("ana");
    expect(params.get("gender")).toBe("female");
    expect(params.get("banned")).toBe("true");
  });

  it("sends banned=false for the not banned and nothing for empty filters", () => {
    TestBed.runInInjectionContext(() => {
      api.list(signal({ ...query, status: "not_banned" }));
      api.list(signal({ ...query, search: "", gender: "", status: "" }));
    });
    TestBed.tick();

    const [notBanned, empty] = controller.match(
      (r) => r.url === "/api/leagues/3/players",
    );
    expect(notBanned.request.params.get("banned")).toBe("false");
    expect(empty.request.params.has("search")).toBe(false);
    expect(empty.request.params.has("gender")).toBe(false);
    expect(empty.request.params.has("banned")).toBe(false);
  });

  it("changes the gender, reporting errors itself", () => {
    api.changeGender(7, "male").subscribe();

    const { request } = controller.expectOne("/api/leagues/3/players/7/gender");
    expect(request.method).toBe("PATCH");
    expect(request.body).toEqual({ gender: "male" });
    expect(request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
  });

  it("bans with a trimmed reason and reactivates", () => {
    api.ban(7, "  Agresión ").subscribe();
    api.unban(7).subscribe();

    const ban = controller.expectOne("/api/leagues/3/players/7/ban").request;
    expect(ban.method).toBe("POST");
    expect(ban.body).toEqual({ reason: "Agresión" });
    expect(ban.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    expect(
      controller.expectOne("/api/leagues/3/players/7/unban").request.method,
    ).toBe("POST");
  });
});
