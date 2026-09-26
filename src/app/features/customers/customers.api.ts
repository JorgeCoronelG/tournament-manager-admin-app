import { HttpClient, httpResource } from "@angular/common/http";
import { computed, inject, Service, Signal } from "@angular/core";
import { SettingsService } from "../../core/settings/settings.service";
import {
  Customer,
  CustomersQuery,
  CustomerStatus,
  NewCustomer,
} from "./customer.model";

/**
 * Talks to the customers endpoints of the API (json-server in development, see
 * `mock/db.json`). Reads are `httpResource`s: they re-request whenever the
 * signals they depend on change and expose `value()`, `isLoading()` and
 * `error()`.
 */
@Service()
export class CustomersApi {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  private url(path = ""): string {
    return this.settings.api(`/customers${path}`);
  }

  /** A page of customers. The total is in the `X-Total-Count` header. */
  list(query: Signal<CustomersQuery>) {
    const resource = httpResource<Customer[]>(() => {
      const { page, pageSize, search, status, sort, order } = query();

      return {
        url: this.url(),
        params: {
          _page: page + 1,
          _limit: pageSize,
          _sort: sort,
          _order: order,
          ...(search ? { q: search } : {}),
          ...(status ? { status } : {}),
        },
      };
    });

    const total = computed(() =>
      Number(resource.headers()?.get("X-Total-Count") ?? 0),
    );

    return { resource, total };
  }

  /** How many customers there are, optionally filtered by status */
  count(status?: CustomerStatus) {
    const resource = httpResource<Customer[]>(() => ({
      url: this.url(),
      params: { _limit: 1, ...(status ? { status } : {}) },
    }));

    return computed(() =>
      Number(resource.headers()?.get("X-Total-Count") ?? 0),
    );
  }

  /** One customer; stays idle while `id` is undefined */
  get(id: Signal<number | undefined>) {
    return httpResource<Customer>(() => {
      const value = id();

      return value === undefined ? undefined : this.url(`/${value}`);
    });
  }

  create(customer: NewCustomer) {
    return this.http.post<Customer>(this.url(), {
      ...customer,
      createdAt: new Date().toISOString(),
    });
  }
}
