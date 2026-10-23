import { HttpClient, HttpContext, httpResource } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { Standings } from "./match.model";

/**
 * Tables of the regular phase (`/leagues/{id}/tournaments/{id}/standings`).
 * Writes skip the generic error notification: the dialog or the page shows the
 * backend's message itself.
 */
@Service()
export class StandingsApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  private url(tournamentId: number, path = ""): string | undefined {
    return this.league.leagueApi(
      `/tournaments/${tournamentId}/standings${path}`,
    );
  }

  /** The tables; waits while `tournamentId` is undefined (no tournament, or one in planning) */
  standings(tournamentId: Signal<number | undefined>) {
    return httpResource<Standings>(() => {
      const id = tournamentId();

      return id === undefined ? undefined : this.url(id);
    });
  }

  /** Orders a set of tied teams, best first */
  saveManualOrder(
    tournamentId: number,
    groupId: number,
    registrationIds: number[],
  ) {
    return this.http.put<Standings>(
      this.url(tournamentId, "/manual-order") ?? "",
      { group_id: groupId, registration_ids: registrationIds },
      this.ownErrors,
    );
  }

  clearManualOrder(tournamentId: number, groupId: number) {
    return this.http.delete<void>(
      this.url(tournamentId, "/manual-order") ?? "",
      { ...this.ownErrors, params: { group_id: groupId } },
    );
  }
}
