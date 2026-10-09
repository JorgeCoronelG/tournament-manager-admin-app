import { HttpClient, HttpContext } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { paginatedResource } from "../../core/http/paginated-resource";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import {
  NewTournament,
  Tournament,
  TournamentStatus,
  TournamentsQuery,
} from "./tournament.model";

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
