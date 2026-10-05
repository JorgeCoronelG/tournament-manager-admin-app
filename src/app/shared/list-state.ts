import { computed, linkedSignal, Signal, signal } from "@angular/core";
import { Sort } from "@angular/material/sort";
import { PageQuery, PaginatedResource } from "../core/http/paginated-resource";

/** MatSort state to the API's `sort` value (`-` prefix for descending) */
export function toSortParam(sort: Sort): string {
  if (!sort.active || !sort.direction) {
    return "";
  }

  return sort.direction === "desc" ? `-${sort.active}` : sort.active;
}

/** A filter counts as active unless it is empty (`""`, `null`, `undefined` or `[]`) */
function isActive(value: unknown): boolean {
  return Array.isArray(value)
    ? value.length > 0
    : value !== "" && value !== null && value !== undefined;
}

export interface ListStateOptions<F extends object, T> {
  /** The filters model; its empty values are `""` (or `null`/`[]`) */
  filters: Signal<F>;
  defaultSort: Sort;
  /** Initial page size (default 5) */
  pageSize?: number;
  /** Builds the request from the reactive query, e.g. `(query) => this.api.list(query)` */
  load: (query: Signal<F & PageQuery>) => PaginatedResource<T>;
}

/**
 * State of a paginated, filterable and sortable list: the order, the page, the
 * query that goes to the API and the rows that come back. Call it in an
 * injection context (a component field). Changing a filter or the order sends
 * the user back to the first page, keeping the page size.
 */
export function listState<F extends object, T>({
  filters,
  defaultSort,
  pageSize = 5,
  load,
}: ListStateOptions<F, T>) {
  const sortState = signal<Sort>(defaultSort);

  const paging = linkedSignal<[F, Sort], Pick<PageQuery, "page" | "pageSize">>({
    source: () => [filters(), sortState()],
    computation: (_, previous) => ({
      page: 0,
      pageSize: previous?.value.pageSize ?? pageSize,
    }),
  });

  const query = computed<F & PageQuery>(() => ({
    ...paging(),
    ...filters(),
    sort: toSortParam(sortState()),
  }));

  const list = load(query);

  // Keep showing the previous rows while the next page is loading
  const rows = linkedSignal<T[] | undefined, T[]>({
    source: list.rows,
    computation: (value, previous) => value ?? previous?.value ?? [],
  });

  /** Tells an empty table (nothing yet) from one emptied by the filters */
  const hasFilters = computed(() => Object.values(filters()).some(isActive));

  return {
    sortState: sortState.asReadonly(),
    paging: paging.asReadonly(),
    resource: list.resource,
    rows,
    total: list.total,
    hasFilters,
    sort: (sort: Sort): void => sortState.set(sort),
    changePage: (event: { pageIndex: number; pageSize: number }): void =>
      paging.set({ page: event.pageIndex, pageSize: event.pageSize }),
  };
}
