import { Service } from "@angular/core";
import { PageQuery } from "../../../core/http/paginated-resource";
import { TournamentHistoryFilters } from "../tournament.model";

/** What the history list had (filters and page), to come back to it from a tournament's detail as it was left */
@Service()
export class TournamentHistoryMemory {
  private saved: {
    leagueId: number;
    filters: TournamentHistoryFilters;
    paging: Pick<PageQuery, "page" | "pageSize">;
  } | null = null;

  save(
    leagueId: number | null,
    filters: TournamentHistoryFilters,
    paging: Pick<PageQuery, "page" | "pageSize">,
  ): void {
    if (leagueId !== null) {
      this.saved = { leagueId, filters: { ...filters }, paging: { ...paging } };
    }
  }

  /** The remembered filters of that league, or empty ones */
  filtersFor(leagueId: number | null): TournamentHistoryFilters {
    return this.saved && this.saved.leagueId === leagueId
      ? { ...this.saved.filters }
      : { search: "", year: "" };
  }

  pagingFor(
    leagueId: number | null,
  ): Pick<PageQuery, "page" | "pageSize"> | undefined {
    return this.saved && this.saved.leagueId === leagueId
      ? { ...this.saved.paging }
      : undefined;
  }
}
