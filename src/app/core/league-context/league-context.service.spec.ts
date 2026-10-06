import {
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
  HttpClient,
} from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ApplicationRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Role } from "../auth/role.model";
import { CurrentUserService } from "../user/current-user.service";
import { leagueContextInterceptor } from "./league-context.interceptor";
import { LeagueContextService } from "./league-context.service";
import { MyLeague } from "./my-league.model";

const leagues = (...ids: number[]): MyLeague[] =>
  ids.map((id) => ({ id, name: `Liga ${id}` }));

const page = (data: MyLeague[]) => ({
  data,
  links: { first: null, last: "x", prev: null, next: null },
  meta: {
    currentPage: 1,
    from: 1,
    lastPage: 1,
    perPage: 100,
    to: data.length,
    total: data.length,
  },
});

describe("LeagueContextService", () => {
  let controller: HttpTestingController;
  let user: CurrentUserService;

  function signInAs(id: number, ...roles: Role[]) {
    user.setUser({ id, name: "Ada", role: "", roles, avatarUrl: null });
  }

  async function respond(data: MyLeague[]) {
    TestBed.tick();
    controller
      .expectOne((r) => r.url.endsWith("/my-leagues"))
      .flush(page(data));
    await TestBed.inject(ApplicationRef).whenStable();
  }

  function setup() {
    const service = TestBed.inject(LeagueContextService);
    user = TestBed.inject(CurrentUserService);
    controller = TestBed.inject(HttpTestingController);

    return service;
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([leagueContextInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => controller.verify());

  it("asks for the leagues with the page size", () => {
    const service = setup();
    signInAs(1, "league_admin");
    TestBed.tick();

    const { params } = controller.expectOne((r) =>
      r.url.endsWith("/my-leagues"),
    ).request;
    expect(params.get("page")).toBe("1");
    expect(params.get("per_page")).toBe("100");
    expect(service.isLoading()).toBe(true);
  });

  it("selects the only league by itself", async () => {
    const service = setup();
    signInAs(1, "league_admin");
    await respond(leagues(4));

    expect(service.activeLeague()).toEqual({ id: 4, name: "Liga 4" });
    expect(service.activeLeagueId()).toBe(4);
  });

  it("keeps the saved league while it is still in the list", async () => {
    localStorage.setItem("app.active-league.1", "6");
    const service = setup();
    signInAs(1, "league_admin");
    await respond(leagues(4, 6, 9));

    expect(service.activeLeagueId()).toBe(6);
  });

  it("leaves none active when the saved league is gone and there are several", async () => {
    localStorage.setItem("app.active-league.1", "77");
    const service = setup();
    signInAs(1, "league_admin");
    await respond(leagues(4, 6));

    expect(service.activeLeague()).toBeNull();
    expect(service.leagues()).toHaveLength(2);
  });

  it("does not pick the first league when nothing was saved", async () => {
    const service = setup();
    signInAs(1, "league_admin");
    await respond(leagues(4, 6));

    expect(service.activeLeagueId()).toBeNull();
  });

  it("selects a league, remembers it per user and ignores unknown ids", async () => {
    const service = setup();
    signInAs(1, "league_admin");
    await respond(leagues(4, 6));

    service.select(6);
    expect(service.activeLeagueId()).toBe(6);
    expect(localStorage.getItem("app.active-league.1")).toBe("6");

    service.select(99);
    expect(service.activeLeagueId()).toBe(6);
  });

  it("clears the selection and forgets it, even with a saved league", async () => {
    localStorage.setItem("app.active-league.1", "6");
    const service = setup();
    signInAs(1, "league_admin");
    await respond(leagues(4, 6));
    expect(service.activeLeagueId()).toBe(6);

    service.clear();

    expect(service.activeLeague()).toBeNull();
    expect(localStorage.getItem("app.active-league.1")).toBeNull();
  });

  it("does not query without the capability", () => {
    const service = setup();
    signInAs(1, "referee");
    TestBed.tick();

    controller.expectNone((r) => r.url.endsWith("/my-leagues"));
    expect(service.leagues()).toEqual([]);
    expect(service.activeLeague()).toBeNull();
  });

  it("clears everything when the session ends", async () => {
    const service = setup();
    signInAs(1, "league_admin");
    await respond(leagues(4));
    expect(service.activeLeagueId()).toBe(4);

    user.clear();
    TestBed.tick();

    expect(service.leagues()).toEqual([]);
    expect(service.activeLeague()).toBeNull();
  });

  it("does not reuse the league another user chose in the same browser", async () => {
    localStorage.setItem("app.active-league.1", "6");
    const service = setup();
    signInAs(1, "league_admin");
    await respond(leagues(4, 6));
    expect(service.activeLeagueId()).toBe(6);

    signInAs(2, "league_admin");
    await respond(leagues(4, 6));

    expect(service.activeLeagueId()).toBeNull();
  });

  it("reports a load error and recovers on reload", async () => {
    const service = setup();
    signInAs(1, "league_admin");
    TestBed.tick();
    controller
      .expectOne((r) => r.url.endsWith("/my-leagues"))
      .flush(null, { status: 500, statusText: "Server Error" });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(service.error()).toBeInstanceOf(HttpErrorResponse);

    service.reload();
    await respond(leagues(4));

    expect(service.error()).toBeUndefined();
    expect(service.activeLeagueId()).toBe(4);
  });

  it("builds the nested url of the active league, or none", async () => {
    const service = setup();
    signInAs(1, "league_admin");
    expect(service.leagueApi("/teams")).toBeUndefined();

    await respond(leagues(4));

    expect(service.leagueApi("/teams")).toMatch(/\/leagues\/4\/teams$/);
  });

  it("reloads the leagues when a nested request answers 403 or 404", async () => {
    const service = setup();
    signInAs(1, "league_admin");
    await respond(leagues(4, 6));
    const http = TestBed.inject(HttpClient);

    for (const [status, now] of [
      [403, 6],
      [404, 8],
    ]) {
      service.select(now === 6 ? 6 : 8);
      const url = service.leagueApi("/tournaments") as string;
      let failure: unknown;
      http.get(url).subscribe({ error: (e: unknown) => (failure = e) });
      controller.expectOne(url).flush(null, { status, statusText: "Nope" });
      expect(failure).toBeInstanceOf(HttpErrorResponse);

      // The league left the list: the usual rule applies again
      await respond(leagues(4, now === 6 ? 8 : 9));
      expect(service.activeLeagueId()).toBeNull();
    }
  });

  it("ignores errors of other requests", async () => {
    const service = setup();
    signInAs(1, "league_admin");
    await respond(leagues(4));
    const http = TestBed.inject(HttpClient);

    http
      .get(service.leagueApi("/x")!.replace("/leagues/4", "/users/4"))
      .subscribe({ error: () => undefined });
    controller
      .expectOne((r) => r.url.includes("/users/4/x"))
      .flush(null, { status: 404, statusText: "Nope" });
    TestBed.tick();

    controller.expectNone((r) => r.url.endsWith("/my-leagues"));
  });
});
