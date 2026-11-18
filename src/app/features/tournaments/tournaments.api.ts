import { HttpClient, HttpContext, httpResource } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { PaginatedResponse } from "../../core/http/paginated-response.model";
import { paginatedResource } from "../../core/http/paginated-resource";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import {
  NewTournament,
  Tournament,
  TournamentHistoryQuery,
  TournamentHistoryRow,
  TournamentStatus,
  TournamentSummary,
  TournamentsQuery,
} from "./tournament.model";

/** The statuses a tournament has before it finishes */
const ACTIVE_STATUSES: readonly TournamentStatus[] = [
  "planning",
  "in_progress",
  "playoffs",
];

/**
 * Tournaments of the active league (`/leagues/{id}/tournaments`; the backend
 * authorizes them). Writes skip the generic error notification: the form maps
 * 422 errors to its fields and reports the rest itself.
 */
@Service()
export class TournamentsApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  /** Endpoint URL; writes only happen with a league active */
  private url(path = ""): string {
    return this.league.leagueApi(`/tournaments${path}`) ?? "";
  }

  /**
   * A page of tournaments of the active league. Waits while there is none and
   * requests again when it changes. Empty filters are not sent.
   */
  list(query: Signal<TournamentsQuery>) {
    return paginatedResource<Tournament, TournamentsQuery>(
      () => this.league.leagueApi("/tournaments"),
      query,
      ({ search, gender, status }) => ({
        ...(search ? { search } : {}),
        ...(gender ? { gender } : {}),
        ...(status ? { status } : {}),
      }),
    );
  }

  /** One tournament of the league; waits while `id` is undefined. A missing one is reported by the page, not by a snackbar */
  get(id: Signal<number | undefined>) {
    return httpResource<Tournament>(() => {
      const tournamentId = id();
      const url =
        tournamentId === undefined
          ? undefined
          : this.league.leagueApi(`/tournaments/${tournamentId}`);

      return url ? { url, context: this.ownErrors.context } : undefined;
    });
  }

  /** The summary of a finished tournament; waits while `id` is undefined */
  summary(id: Signal<number | undefined>) {
    return httpResource<TournamentSummary>(() => {
      const tournamentId = id();

      return tournamentId === undefined
        ? undefined
        : this.league.leagueApi(`/tournaments/${tournamentId}/summary`);
    });
  }

  /** A page of the league's finished tournaments, newest first, with their teams and playoffs */
  history(query: Signal<TournamentHistoryQuery>) {
    return paginatedResource<TournamentHistoryRow, TournamentHistoryQuery>(
      () => this.league.leagueApi("/tournaments/history"),
      query,
      ({ search, year }) => ({
        ...(search ? { search } : {}),
        ...(year ? { year } : {}),
      }),
    );
  }

  /** The years that have finished tournaments in the league, for the history filter */
  historyYears() {
    return httpResource<{ data: number[] }>(() =>
      this.league.leagueApi("/tournaments/history/years"),
    );
  }

  /**
   * The league's tournaments, newest first, for a selector; waits while there
   * is no league. With `statuses` the backend only returns those (`status[]`).
   */
  options(statuses?: readonly TournamentStatus[]) {
    return httpResource<PaginatedResponse<Tournament>>(() => {
      const url = this.league.leagueApi("/tournaments");

      return url
        ? {
            url,
            params: {
              per_page: 100,
              sort: "-start_date",
              ...(statuses ? { "status[]": statuses } : {}),
            },
          }
        : undefined;
    });
  }

  /**
   * Same selector list without the finished tournaments: the backend filters
   * them (`status[]`), so they are never requested
   */
  activeOptions() {
    return httpResource<PaginatedResponse<Tournament>>(() => {
      const url = this.league.leagueApi("/tournaments");

      return url
        ? {
            url,
            params: {
              per_page: 100,
              sort: "-start_date",
              "status[]": ACTIVE_STATUSES,
            },
          }
        : undefined;
    });
  }

  create(tournament: NewTournament) {
    return this.http.post<Tournament>(this.url(), tournament, this.ownErrors);
  }

  update(id: number, tournament: NewTournament) {
    return this.http.put<Tournament>(
      this.url(`/${id}`),
      tournament,
      this.ownErrors,
    );
  }

  /** Only forward: planning → in_progress → finished */
  setStatus(id: number, status: TournamentStatus) {
    return this.http.patch<Tournament>(
      this.url(`/${id}/status`),
      { status },
      this.ownErrors,
    );
  }

  remove(id: number) {
    return this.http.delete<void>(this.url(`/${id}`), this.ownErrors);
  }
}
