import { httpResource, HttpResourceRef } from "@angular/common/http";
import { computed, Signal } from "@angular/core";
import { PaginatedResponse } from "./paginated-response.model";

/** What every paginated list sends: the page and the order */
export interface PageQuery {
  /** Zero-based page index (MatPaginator); the API's `page` starts at 1 */
  page: number;
  pageSize: number;
  /** Comma-separated fields, `-` prefix for descending. Empty: API default. */
  sort: string;
}

export interface PaginatedResource<T> {
  resource: HttpResourceRef<PaginatedResponse<T> | undefined>;
  /** `undefined` until the first response */
  rows: Signal<T[] | undefined>;
  total: Signal<number>;
}

/**
 * Reads a page of a Laravel-style paginated endpoint and re-requests it
 * whenever `query` changes. `filterParams` maps the filters of `query` to the
 * API's params; return only the ones that have a value.
 */
export function paginatedResource<T, Q extends PageQuery>(
  url: () => string,
  query: Signal<Q>,
  filterParams: (query: Q) => Record<string, string | number>,
): PaginatedResource<T> {
  const resource = httpResource<PaginatedResponse<T>>(() => {
    const current = query();

    return {
      url: url(),
      params: {
        page: current.page + 1,
        per_page: current.pageSize,
        ...(current.sort ? { sort: current.sort } : {}),
        ...filterParams(current),
      },
    };
  });

  const rows = computed(() => resource.value()?.data);
  const total = computed(() => resource.value()?.meta.total ?? 0);

  return { resource, rows, total };
}
