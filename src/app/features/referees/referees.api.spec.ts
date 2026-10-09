import { HttpErrorResponse, provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ApplicationRef, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { PaginatedResponse } from "../../core/http/paginated-response.model";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { Referee, RefereesQuery } from "./referee.model";
import { RefereesApi } from "./referees.api";

const referee = (id: number): Referee => ({
  id,
  first_name: `Ana${id}`,
  last_name: "Pérez",
  email: `a${id}@example.com`,
  phone: null,
  user_code: `R${id}`,
  photo_url: null,
  account_status: "active",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
});

const page = (rows: Referee[], total: number): PaginatedResponse<Referee> => ({
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

const emptyQuery = (): RefereesQuery => ({
  page: 0,
  pageSize: 5,
  search: "",
  status: "",
  sort: "",
});

describe("RefereesApi", () => {
  let api: RefereesApi;
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

    api = TestBed.inject(RefereesApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("requests the active league's referees with snake_case params, converting the page and reading the total", async () => {
    const query = signal<RefereesQuery>({
      ...emptyQuery(),
      page: 1,
      pageSize: 10,
      search: "ana",
      status: "inactive",
      sort: "-first_name",
    });

    const { rows, total } = TestBed.runInInjectionContext(() =>
      api.list(query),
    );
    TestBed.tick();

    const request = controller.expectOne(
      (r) => r.url === "/api/leagues/3/referees",
    );
    const { params } = request.request;
    expect(params.get("page")).toBe("2");
    expect(params.get("per_page")).toBe("10");
    expect(params.get("search")).toBe("ana");
    expect(params.get("status")).toBe("inactive");
    expect(params.get("sort")).toBe("-first_name");

    request.flush(page([referee(1), referee(2)], 42));
    await TestBed.inject(ApplicationRef).whenStable();

    expect(rows()).toHaveLength(2);
    expect(total()).toBe(42);
  });

  it("omits empty params", () => {
    TestBed.runInInjectionContext(() => api.list(signal(emptyQuery())));
    TestBed.tick();

    const { params } = controller.expectOne((r) =>
      r.url.endsWith("/referees"),
    ).request;
    expect(params.keys().sort()).toEqual(["page", "per_page"]);
  });

  it("waits without a league", () => {
    leagueId.set(null);
    TestBed.runInInjectionContext(() => api.list(signal(emptyQuery())));
    TestBed.tick();

    controller.expectNone((r) => r.url.endsWith("/referees"));
  });

  it("looks a referee up by code only once there is one", async () => {
    const code = signal("");
    const lookup = TestBed.runInInjectionContext(() => api.lookup(code));
    TestBed.tick();
    controller.expectNone((r) => r.url.includes("/lookup"));

    code.set("ABC123");
    TestBed.tick();
    const request = controller.expectOne(
      (r) => r.url === "/api/leagues/3/referees/lookup",
    );
    expect(request.request.params.get("user_code")).toBe("ABC123");

    request.flush({
      user_id: 7,
      first_name: "Ana",
      last_name: "Pérez",
      photo_url: null,
      already_in_league: false,
    });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(lookup.value()?.user_id).toBe(7);
  });

  it("exposes the lookup's error status", async () => {
    const lookup = TestBed.runInInjectionContext(() =>
      api.lookup(signal("NOPE")),
    );
    TestBed.tick();

    controller
      .expectOne((r) => r.url.includes("/lookup"))
      .flush(null, { status: 429, statusText: "Too Many Requests" });
    await TestBed.inject(ApplicationRef).whenStable();

    expect((lookup.error() as HttpErrorResponse).status).toBe(429);
  });

  it("creates, attaches, updates, changes the status of, removes and re-invites", () => {
    const body = {
      first_name: "Ana",
      last_name: "Pérez",
      email: "ana@example.com",
      phone: null,
    };
    const expectCall = (url: string, method: string, requestBody?: unknown) => {
      const request = controller.expectOne(url);
      expect(request.request.method).toBe(method);

      if (requestBody !== undefined) {
        expect(request.request.body).toEqual(requestBody);
      }

      request.flush(null, { status: 200, statusText: "OK" });
    };

    api.create(body).subscribe();
    expectCall("/api/leagues/3/referees", "POST", body);

    api.attach("ABC123").subscribe();
    expectCall("/api/leagues/3/referees/attach", "POST", {
      user_code: "ABC123",
    });

    api.update(5, body).subscribe();
    expectCall("/api/leagues/3/referees/5", "PUT", body);

    api.setStatus(5, "inactive").subscribe();
    expectCall("/api/leagues/3/referees/5/status", "PATCH", {
      status: "inactive",
    });

    api.remove(5).subscribe();
    expectCall("/api/leagues/3/referees/5", "DELETE");

    api.resendInvitation(5).subscribe();
    expectCall("/api/leagues/3/referees/5/resend-invitation", "POST");
  });
});
