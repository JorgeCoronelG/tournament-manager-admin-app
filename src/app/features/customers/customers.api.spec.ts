import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ApplicationRef, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { CustomersApi } from "./customers.api";
import { Customer, CustomersQuery } from "./customer.model";

const customer = (id: number): Customer => ({
  id,
  name: `Customer ${id}`,
  email: `c${id}@example.com`,
  company: "Acme",
  country: "Mexico",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("CustomersApi", () => {
  let api: CustomersApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    api = TestBed.inject(CustomersApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("requests the page, sort and filters and reads the total from the header", async () => {
    const query = signal<CustomersQuery>({
      page: 1,
      pageSize: 10,
      search: "ada",
      status: "active",
      sort: "name",
      order: "desc",
    });

    const { resource, total } = TestBed.runInInjectionContext(() =>
      api.list(query),
    );
    TestBed.tick();

    const request = controller.expectOne((r) => r.url.endsWith("/customers"));
    expect(request.request.params.get("_page")).toBe("2");
    expect(request.request.params.get("_limit")).toBe("10");
    expect(request.request.params.get("_sort")).toBe("name");
    expect(request.request.params.get("_order")).toBe("desc");
    expect(request.request.params.get("q")).toBe("ada");
    expect(request.request.params.get("status")).toBe("active");

    request.flush([customer(1), customer(2)], {
      headers: { "X-Total-Count": "42" },
    });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(resource.value()).toHaveLength(2);
    expect(total()).toBe(42);
  });

  it("omits empty filters", () => {
    const query = signal<CustomersQuery>({
      page: 0,
      pageSize: 5,
      search: "",
      status: "",
      sort: "createdAt",
      order: "asc",
    });

    TestBed.runInInjectionContext(() => api.list(query));
    TestBed.tick();

    const { params } = controller.expectOne((r) =>
      r.url.endsWith("/customers"),
    ).request;
    expect(params.has("q")).toBe(false);
    expect(params.has("status")).toBe(false);
  });

  it("does not request a customer until it has an id", () => {
    const id = signal<number | undefined>(undefined);

    TestBed.runInInjectionContext(() => api.get(id));
    TestBed.tick();
    controller.expectNone(() => true);

    id.set(7);
    TestBed.tick();
    controller
      .expectOne((r) => r.url.endsWith("/customers/7"))
      .flush(customer(7));
  });

  it("creates a customer with a creation date", () => {
    let created: Customer | undefined;

    api
      .create({
        name: "Ada",
        email: "ada@example.com",
        company: "Acme",
        country: "Spain",
        status: "active",
      })
      .subscribe((value) => (created = value));

    const request = controller.expectOne((r) => r.url.endsWith("/customers"));
    expect(request.request.method).toBe("POST");
    expect(request.request.body.createdAt).toBeTruthy();

    request.flush(customer(99));
    expect(created?.id).toBe(99);
  });
});
