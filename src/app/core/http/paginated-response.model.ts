export interface PaginatedLinks {
  first: string | null;
  last: string;
  prev: string | null;
  next: string | null;
}

export interface PaginatedMeta {
  currentPage: number;
  from: number | null;
  lastPage: number;
  perPage: number;
  to: number | null;
  total: number;
}

/**
 * Laravel-style paginated response. `meta.currentPage` starts at 1. What only
 * some endpoints add (extra `meta` fields, a `summary`) is typed where it is
 * requested, e.g. `PaginatedResponse<T, MyMeta> & { summary: ... }`.
 */
export interface PaginatedResponse<T, M extends PaginatedMeta = PaginatedMeta> {
  data: T[];
  links: PaginatedLinks;
  meta: M;
}
