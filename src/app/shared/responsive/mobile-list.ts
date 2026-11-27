import {
  computed,
  ElementRef,
  signal,
  Signal,
  WritableSignal,
} from "@angular/core";

export interface MobileListOptions<F extends object> {
  /** The filters model of the list (`""` is an empty value) */
  filters: WritableSignal<F>;
  /** Filters that count in the badge and that "Clear" resets (the search box is not one) */
  activeKeys: Array<keyof F>;
  /** The page changer of `listState` */
  changePage: (event: { pageIndex: number; pageSize: number }) => void;
  /** The element that holds the table, to scroll back to it on a page change */
  tableCard: Signal<ElementRef<HTMLElement> | undefined>;
}

/** Default page size of a list: 10 on phones, `listState`'s default elsewhere */
export const mobilePageSize = (isMobile: boolean): number | undefined =>
  isMobile ? 10 : undefined;

/**
 * What a list does differently on phones: the folding filters panel (open from
 * the start only if a filter is already in use), the filter count for the
 * badge, "Clear", and going back to the top of the table on a page change.
 * Call it in an injection context (a component field), after `listState`.
 */
export function mobileList<F extends object>({
  filters,
  activeKeys,
  changePage,
  tableCard,
}: MobileListOptions<F>) {
  const activeFilters = computed(
    () => activeKeys.filter((key) => filters()[key] !== "").length,
  );

  return {
    activeFilters,
    filtersOpen: signal(activeFilters() > 0),
    clearFilters: (): void =>
      filters.update((current) => ({
        ...current,
        ...Object.fromEntries(activeKeys.map((key) => [key, ""])),
      })),
    changePage: (event: { pageIndex: number; pageSize: number }): void => {
      changePage(event);
      // On phones the page scrolls, not the table
      tableCard()?.nativeElement.scrollIntoView?.({ block: "start" });
    },
  };
}
