import { signal, WritableSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
  PageQuery,
  PaginatedResource,
} from "../../core/http/paginated-resource";
import { listState, toSortParam } from "./list-state";

interface Filters {
  search: string;
  roleId: number | "";
  tags: string[];
}

describe("listState", () => {
  let filters: WritableSignal<Filters>;
  let rows: WritableSignal<number[] | undefined>;
  let query: () => Filters & PageQuery;

  function setup(pageSize?: number) {
    return TestBed.runInInjectionContext(() =>
      listState({
        filters,
        defaultSort: { active: "created_at", direction: "desc" },
        pageSize,
        load: (q) => {
          query = q;

          return {
            resource: {} as PaginatedResource<number>["resource"],
            rows,
            total: signal(0),
          };
        },
      }),
    );
  }

  beforeEach(() => {
    filters = signal({ search: "", roleId: "", tags: [] });
    rows = signal<number[] | undefined>(undefined);
  });

  it("starts on the first page, with the default order and page size", () => {
    setup();

    expect(query()).toEqual({
      page: 0,
      pageSize: 5,
      sort: "-created_at",
      search: "",
      roleId: "",
      tags: [],
    });
    expect(setup(25).paging()).toEqual({ page: 0, pageSize: 25 });
  });

  it("goes back to the first page, keeping the page size, when a filter or the order changes", () => {
    const list = setup();

    list.changePage({ pageIndex: 3, pageSize: 10 });
    expect(query()).toMatchObject({ page: 3, pageSize: 10 });

    filters.update((value) => ({ ...value, roleId: 2 }));
    expect(query()).toMatchObject({ page: 0, pageSize: 10, roleId: 2 });

    list.changePage({ pageIndex: 2, pageSize: 10 });
    list.sort({ active: "first_name", direction: "asc" });
    expect(query()).toMatchObject({ page: 0, sort: "first_name" });
    expect(list.sortState()).toEqual({
      active: "first_name",
      direction: "asc",
    });
  });

  it("keeps the previous rows while the next page loads", () => {
    const list = setup();

    expect(list.rows()).toEqual([]);

    rows.set([1, 2]);
    expect(list.rows()).toEqual([1, 2]);

    rows.set(undefined);
    expect(list.rows()).toEqual([1, 2]);
  });

  it("tells whether any filter is active", () => {
    const list = setup();

    expect(list.hasFilters()).toBe(false);

    filters.set({ search: "ana", roleId: "", tags: [] });
    expect(list.hasFilters()).toBe(true);

    filters.set({ search: "", roleId: 0, tags: [] });
    expect(list.hasFilters()).toBe(true);

    filters.set({ search: "", roleId: "", tags: ["a"] });
    expect(list.hasFilters()).toBe(true);

    filters.set({ search: "", roleId: "", tags: [] });
    expect(list.hasFilters()).toBe(false);
  });
});

describe("toSortParam", () => {
  it("builds the sort param", () => {
    expect(toSortParam({ active: "last_name", direction: "desc" })).toBe(
      "-last_name",
    );
    expect(toSortParam({ active: "last_name", direction: "asc" })).toBe(
      "last_name",
    );
    expect(toSortParam({ active: "last_name", direction: "" })).toBe("");
  });
});
