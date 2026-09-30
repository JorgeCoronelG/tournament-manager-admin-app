/** Laravel-style paginated response. `meta.currentPage` starts at 1. */
export interface PaginatedResponse<T> {
  data: T[];
  links: {
    first: string | null;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    currentPage: number;
    from: number | null;
    lastPage: number;
    perPage: number;
    to: number | null;
    total: number;
  };
}
