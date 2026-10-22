import { HttpClient, HttpContext } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { paginatedResource } from "../../core/http/paginated-resource";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { RosterEntry, RostersQuery } from "./roster.model";

/**
 * Roster of a team enrolled in a tournament of the active league
 * (`/leagues/{id}/tournaments/{id}/registrations/{id}/roster`). It is read and
 * moderated here; the requests come from the delegate's app. The backend
 * filters, searches and pages the list. Writes skip the
 * generic error notification so the page can show the backend's message.
 */
@Service()
export class RostersApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  private url(
    tournamentId: number | undefined,
    registrationId: number | undefined,
    path = "",
  ): string | undefined {
    return tournamentId === undefined || registrationId === undefined
      ? undefined
      : this.league.leagueApi(
          `/tournaments/${tournamentId}/registrations/${registrationId}/roster${path}`,
        );
  }

  /** A page of the roster; waits while no tournament or team is picked */
  list(
    tournamentId: Signal<number | undefined>,
    registrationId: Signal<number | undefined>,
    query: Signal<RostersQuery>,
  ) {
    return paginatedResource<RosterEntry, RostersQuery>(
      () => this.url(tournamentId(), registrationId()),
      query,
      ({ search, status }): Record<string, string> => ({
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      }),
    );
  }

  remove(
    tournamentId: number,
    registrationId: number,
    rosterId: number,
    reason: string,
  ) {
    return this.http.patch<RosterEntry>(
      this.url(tournamentId, registrationId, `/${rosterId}/remove`) ?? "",
      { removal_reason: reason.trim() },
      this.ownErrors,
    );
  }

  authorizeRejoin(
    tournamentId: number,
    registrationId: number,
    rosterId: number,
  ) {
    return this.http.post<RosterEntry>(
      this.url(tournamentId, registrationId, `/${rosterId}/rejoin`) ?? "",
      {},
      this.ownErrors,
    );
  }

  revokeRejoin(tournamentId: number, registrationId: number, rosterId: number) {
    return this.http.delete<RosterEntry>(
      this.url(tournamentId, registrationId, `/${rosterId}/rejoin`) ?? "",
      this.ownErrors,
    );
  }
}
