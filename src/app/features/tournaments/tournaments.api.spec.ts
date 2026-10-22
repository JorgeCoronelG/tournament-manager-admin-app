import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ApplicationRef, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { PaginatedResponse } from "../../core/http/paginated-response.model";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { Tournament, TournamentsQuery } from "./tournament.model";
import { TournamentsApi } from "./tournaments.api";

const tournament = (id: number): Tournament => ({
  id,
  league_id: 3,
  name: `Torneo ${id}`,
  gender: "mixed",
  min_age: null,
  max_age: null,
  start_date: "2026-03-01",
  max_roster_size: null,
  min_matches_for_playoffs: null,
  playoffs_started: false,
  status: "planning",
  created_at: "2026-01-01T00:00:00.000Z",
});

const page = (
  rows: Tournament[],
  total: number,
): PaginatedResponse<Tournament> => ({
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

const emptyQuery = (): TournamentsQuery => ({
  page: 0,
  pageSize: 5,
  search: "",
  gender: "",
  status: "",
  sort: "",
});

describe("TournamentsApi", () => {
  let api: TournamentsApi;
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

    api = TestBed.inject(TournamentsApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("requests the active league's tournaments with snake_case params, converting the page and reading the total", async () => {
    const query = signal<TournamentsQuery>({
      ...emptyQuery(),
      page: 1,
      pageSize: 10,
      search: "apertura",
      gender: "female",
      status: "in_progress",
      sort: "-start_date",
    });

    const { rows, total } = TestBed.runInInjectionContext(() =>
      api.list(query),
    );
    TestBed.tick();

    const request = controller.expectOne(
      (r) => r.url === "/api/leagues/3/tournaments",
    );
    const { params } = request.request;
    expect(params.get("page")).toBe("2");
    expect(params.get("per_page")).toBe("10");
    expect(params.get("search")).toBe("apertura");
    expect(params.get("gender")).toBe("female");
    expect(params.get("status")).toBe("in_progress");
    expect(params.get("sort")).toBe("-start_date");

    request.flush(page([tournament(1), tournament(2)], 42));
    await TestBed.inject(ApplicationRef).whenStable();

    expect(rows()).toHaveLength(2);
    expect(total()).toBe(42);
  });

  it("omits empty params", () => {
    TestBed.runInInjectionContext(() => api.list(signal(emptyQuery())));
    TestBed.tick();

    const { params } = controller.expectOne((r) =>
      r.url.endsWith("/tournaments"),
    ).request;
    expect(params.keys().sort()).toEqual(["page", "per_page"]);
  });

  it("waits without a league and requests again when it changes", () => {
    leagueId.set(null);
    TestBed.runInInjectionContext(() => api.list(signal(emptyQuery())));
    TestBed.tick();
    controller.expectNone((r) => r.url.endsWith("/tournaments"));
  });

  it("creates, updates, changes the status of and deletes a tournament", () => {
    const body = {
      name: "Apertura",
      gender: "male" as const,
      min_age: 18,
      max_age: null,
      start_date: "2026-03-01",
      max_roster_size: null,
      min_matches_for_playoffs: null,
    };

    api.create(body).subscribe();
    let request = controller.expectOne("/api/leagues/3/tournaments");
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual(body);
    request.flush(tournament(1));

    api.update(1, body).subscribe();
    request = controller.expectOne("/api/leagues/3/tournaments/1");
    expect(request.request.method).toBe("PUT");
    expect(request.request.body).toEqual(body);
    request.flush(tournament(1));

    api.setStatus(1, "in_progress").subscribe();
    request = controller.expectOne("/api/leagues/3/tournaments/1/status");
    expect(request.request.method).toBe("PATCH");
    expect(request.request.body).toEqual({ status: "in_progress" });
    request.flush(tournament(1));

    api.remove(1).subscribe();
    request = controller.expectOne("/api/leagues/3/tournaments/1");
    expect(request.request.method).toBe("DELETE");
    request.flush(null, { status: 204, statusText: "No Content" });
  });
});
