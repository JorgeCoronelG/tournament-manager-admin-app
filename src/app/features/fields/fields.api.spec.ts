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
import { Field, FieldsQuery } from "./field.model";
import { FieldsApi } from "./fields.api";

const field = (id: number): Field => ({
  id,
  league_id: 3,
  name: `Cancha ${id}`,
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
});

const page = (rows: Field[], total: number): PaginatedResponse<Field> => ({
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

const emptyQuery = (): FieldsQuery => ({
  page: 0,
  pageSize: 5,
  search: "",
  status: "",
  sort: "",
});

describe("FieldsApi", () => {
  let api: FieldsApi;
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

    api = TestBed.inject(FieldsApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("requests the active league's fields with snake_case params, converting the page and reading the total", async () => {
    const query = signal<FieldsQuery>({
      ...emptyQuery(),
      page: 1,
      pageSize: 10,
      search: "norte",
      status: "inactive",
      sort: "-name",
    });

    const { rows, total } = TestBed.runInInjectionContext(() =>
      api.list(query),
    );
    TestBed.tick();

    const request = controller.expectOne(
      (r) => r.url === "/api/leagues/3/fields",
    );
    const { params } = request.request;
    expect(params.get("page")).toBe("2");
    expect(params.get("per_page")).toBe("10");
    expect(params.get("search")).toBe("norte");
    expect(params.get("status")).toBe("inactive");
    expect(params.get("sort")).toBe("-name");

    request.flush(page([field(1), field(2)], 42));
    await TestBed.inject(ApplicationRef).whenStable();

    expect(rows()).toHaveLength(2);
    expect(total()).toBe(42);
  });

  it("omits empty params", () => {
    TestBed.runInInjectionContext(() => api.list(signal(emptyQuery())));
    TestBed.tick();

    const { params } = controller.expectOne((r) =>
      r.url.endsWith("/fields"),
    ).request;
    expect(params.keys().sort()).toEqual(["page", "per_page"]);
  });

  it("waits without a league", () => {
    leagueId.set(null);
    TestBed.runInInjectionContext(() => api.list(signal(emptyQuery())));
    TestBed.tick();

    controller.expectNone((r) => r.url.endsWith("/fields"));
  });

  it("creates, updates, changes the status of and removes under the league's id", () => {
    const expectCall = (url: string, method: string, body?: unknown) => {
      const request = controller.expectOne(url);
      expect(request.request.method).toBe(method);

      if (body !== undefined) {
        expect(request.request.body).toEqual(body);
      }

      request.flush(null, { status: 200, statusText: "OK" });
    };

    api.create({ name: "Norte", status: "active" }).subscribe();
    expectCall("/api/leagues/3/fields", "POST", {
      name: "Norte",
      status: "active",
    });

    api.update(5, { name: "Sur" }).subscribe();
    expectCall("/api/leagues/3/fields/5", "PUT", { name: "Sur" });

    api.setStatus(5, "inactive").subscribe();
    expectCall("/api/leagues/3/fields/5/status", "PATCH", {
      status: "inactive",
    });

    api.remove(5).subscribe();
    expectCall("/api/leagues/3/fields/5", "DELETE");
  });

  it("skips the generic error notification on writes", () => {
    api.create({ name: "Norte" }).subscribe({ error: () => undefined });

    const request = controller.expectOne("/api/leagues/3/fields");
    expect(request.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    request.flush(null, { status: 422, statusText: "Unprocessable" });
  });

  it("lets the 422 reach the caller", () => {
    let status = 0;
    api.update(1, { name: "x" }).subscribe({
      error: (error: HttpErrorResponse) => (status = error.status),
    });

    controller
      .expectOne("/api/leagues/3/fields/1")
      .flush(null, { status: 422, statusText: "Unprocessable" });

    expect(status).toBe(422);
  });
});
