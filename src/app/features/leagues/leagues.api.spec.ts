import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ApplicationRef, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { PaginatedResponse } from "../../core/http/paginated-response.model";
import { League, LeaguesQuery } from "./league.model";
import { LeaguesApi } from "./leagues.api";

const league = (id: number): League => ({
  id,
  name: `Liga ${id}`,
  admin: {
    id: 7,
    first_name: "Ana",
    last_name: "Pérez",
    email: "ana@example.com",
    status: "active",
  },
  created_at: "2026-01-01T00:00:00.000Z",
});

const page = (leagues: League[], total: number): PaginatedResponse<League> => ({
  data: leagues,
  links: { first: null, last: "x?page=9", prev: null, next: "x?page=2" },
  meta: {
    currentPage: 1,
    from: 1,
    lastPage: 9,
    perPage: 5,
    to: leagues.length,
    total,
  },
});

describe("LeaguesApi", () => {
  let api: LeaguesApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    api = TestBed.inject(LeaguesApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("sends the query as snake_case params, converts the page and reads the total from meta", async () => {
    const query = signal<LeaguesQuery>({
      page: 1,
      pageSize: 10,
      search: "norte",
      adminUserId: 7,
      sort: "-created_at",
    });

    const { rows, total } = TestBed.runInInjectionContext(() =>
      api.list(query),
    );
    TestBed.tick();

    const request = controller.expectOne((r) => r.url.endsWith("/leagues"));
    const { params } = request.request;
    expect(params.get("page")).toBe("2");
    expect(params.get("per_page")).toBe("10");
    expect(params.get("search")).toBe("norte");
    expect(params.get("admin_user_id")).toBe("7");
    expect(params.get("sort")).toBe("-created_at");

    request.flush(page([league(1), league(2)], 42));
    await TestBed.inject(ApplicationRef).whenStable();

    expect(rows()).toHaveLength(2);
    expect(total()).toBe(42);
  });

  it("omits empty params", () => {
    const query = signal<LeaguesQuery>({
      page: 0,
      pageSize: 5,
      search: "",
      adminUserId: "",
      sort: "",
    });

    TestBed.runInInjectionContext(() => api.list(query));
    TestBed.tick();

    const { params } = controller.expectOne((r) =>
      r.url.endsWith("/leagues"),
    ).request;
    expect(params.keys().sort()).toEqual(["page", "per_page"]);
  });

  it("reads, creates, updates and deletes a league", () => {
    const body = { name: "Liga Norte", admin_user_id: 7 };

    api.get(1).subscribe();
    let request = controller.expectOne((r) => r.url.endsWith("/leagues/1"));
    expect(request.request.method).toBe("GET");
    request.flush(league(1));

    api.create(body).subscribe();
    request = controller.expectOne((r) => r.url.endsWith("/leagues"));
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual(body);
    request.flush(league(1));

    api.update(1, body).subscribe();
    request = controller.expectOne((r) => r.url.endsWith("/leagues/1"));
    expect(request.request.method).toBe("PUT");
    expect(request.request.body).toEqual(body);
    request.flush(league(1));

    api.remove(1).subscribe();
    request = controller.expectOne((r) => r.url.endsWith("/leagues/1"));
    expect(request.request.method).toBe("DELETE");
    request.flush(null, { status: 204, statusText: "No Content" });
  });

  it("looks for manager candidates only once the role is known", () => {
    const roleId = signal<number | undefined>(undefined);
    const search = signal("");

    TestBed.runInInjectionContext(() => api.adminCandidates(roleId, search));
    TestBed.tick();
    controller.expectNone((r) => r.url.endsWith("/users"));

    roleId.set(3);
    search.set("ana");
    TestBed.tick();

    const { params } = controller.expectOne((r) =>
      r.url.endsWith("/users"),
    ).request;
    expect(params.get("role_id")).toBe("3");
    expect(params.get("search")).toBe("ana");
    expect(params.get("per_page")).toBe("20");
  });
});
