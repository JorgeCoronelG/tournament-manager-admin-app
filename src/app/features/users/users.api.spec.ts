import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ApplicationRef, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { PaginatedResponse } from "../../core/http/paginated-response.model";
import { User, UsersQuery } from "./user.model";
import { UsersApi } from "./users.api";

const user = (id: number): User => ({
  id,
  first_name: `Ana ${id}`,
  last_name: "Pérez",
  email: `u${id}@example.com`,
  phone: null,
  user_code: `U${id}`,
  photo_url: null,
  is_active: true,
  email_verified_at: null,
  status: "pending",
  roles: [{ id: 2, code: "player", name: "Jugador" }],
  created_at: "2026-01-01T00:00:00.000Z",
});

const page = (users: User[], total: number): PaginatedResponse<User> => ({
  data: users,
  links: { first: null, last: "x?page=9", prev: null, next: "x?page=2" },
  meta: {
    currentPage: 1,
    from: 1,
    lastPage: 9,
    perPage: 5,
    to: users.length,
    total,
  },
});

describe("UsersApi", () => {
  let api: UsersApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    api = TestBed.inject(UsersApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("sends the query as snake_case params, converts the page and reads the total from meta", async () => {
    const query = signal<UsersQuery>({
      page: 1,
      pageSize: 10,
      search: "ana",
      roleId: 2,
      status: "pending",
      sort: "-created_at",
    });

    const { rows, total } = TestBed.runInInjectionContext(() =>
      api.list(query),
    );
    TestBed.tick();

    const request = controller.expectOne((r) => r.url.endsWith("/users"));
    const { params } = request.request;
    expect(params.get("page")).toBe("2");
    expect(params.get("per_page")).toBe("10");
    expect(params.get("search")).toBe("ana");
    expect(params.get("role_id")).toBe("2");
    expect(params.get("status")).toBe("pending");
    expect(params.get("sort")).toBe("-created_at");
    expect(params.has("q")).toBe(false);

    request.flush(page([user(1), user(2)], 42));
    await TestBed.inject(ApplicationRef).whenStable();

    expect(rows()).toHaveLength(2);
    expect(total()).toBe(42);
  });

  it("omits empty params", () => {
    const query = signal<UsersQuery>({
      page: 0,
      pageSize: 5,
      search: "",
      roleId: "",
      status: "",
      sort: "",
    });

    TestBed.runInInjectionContext(() => api.list(query));
    TestBed.tick();

    const { params } = controller.expectOne((r) =>
      r.url.endsWith("/users"),
    ).request;
    expect(params.keys().sort()).toEqual(["page", "per_page"]);
    expect(params.get("page")).toBe("1");
  });

  it("re-requests the first page when the query changes", () => {
    const query = signal<UsersQuery>({
      page: 3,
      pageSize: 5,
      search: "",
      roleId: "",
      status: "",
      sort: "",
    });

    TestBed.runInInjectionContext(() => api.list(query));
    TestBed.tick();
    controller
      .expectOne((r) => r.url.endsWith("/users"))
      .flush(page([user(1)], 1));

    query.update((value) => ({ ...value, page: 0, roleId: 4 }));
    TestBed.tick();

    const { params } = controller.expectOne((r) =>
      r.url.endsWith("/users"),
    ).request;
    expect(params.get("page")).toBe("1");
    expect(params.get("role_id")).toBe("4");
  });

  it("toggles the status with PATCH", () => {
    api.setStatus(7, false).subscribe();

    const request = controller.expectOne((r) =>
      r.url.endsWith("/users/7/status"),
    );
    expect(request.request.method).toBe("PATCH");
    expect(request.request.body).toEqual({ is_active: false });
    request.flush(user(7));
  });

  it("creates, updates, deletes and resends the invitation", () => {
    const body = {
      first_name: "Ana",
      last_name: "Pérez",
      email: "ana@example.com",
      phone: null,
      roles: [2],
    };

    api.create(body).subscribe();
    let request = controller.expectOne((r) => r.url.endsWith("/users"));
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual(body);
    request.flush(user(1));

    api.update(1, { ...body, is_active: true }).subscribe();
    request = controller.expectOne((r) => r.url.endsWith("/users/1"));
    expect(request.request.method).toBe("PUT");
    expect(request.request.body.is_active).toBe(true);
    request.flush(user(1));

    api.remove(1).subscribe();
    request = controller.expectOne((r) => r.url.endsWith("/users/1"));
    expect(request.request.method).toBe("DELETE");
    request.flush(null, { status: 204, statusText: "No Content" });

    api.resendInvitation(1).subscribe();
    request = controller.expectOne((r) =>
      r.url.endsWith("/users/1/resend-invitation"),
    );
    expect(request.request.method).toBe("POST");
    request.flush({});
  });
});
