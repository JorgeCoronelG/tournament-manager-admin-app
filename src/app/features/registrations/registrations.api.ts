import { HttpClient, HttpContext, httpResource } from "@angular/common/http";
import { computed, inject, Service, Signal } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { PaginatedResponse } from "../../core/http/paginated-response.model";
import { paginatedResource } from "../../core/http/paginated-resource";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import {
  AvailableTeam,
  Registration,
  RegistrationsQuery,
  ReplaceResult,
  TeamChange,
  WithdrawPreview,
  WithdrawResult,
} from "./registration.model";

/** How many candidate teams the dialog asks for at once */
const AVAILABLE_PAGE_SIZE = 50;

/**
 * Teams enrolled in a tournament of the active league
 * (`/leagues/{id}/tournaments/{id}/registrations`; the backend authorizes them).
 * Writes skip the generic error notification: the dialog shows which team the
 * backend refused and the page reports the rest itself.
 */
@Service()
export class RegistrationsApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  /** Endpoint URL; waits (undefined) while there is no league or tournament */
  private url(tournamentId: number | undefined, path = ""): string | undefined {
    return tournamentId === undefined
      ? undefined
      : this.league.leagueApi(
          `/tournaments/${tournamentId}/registrations${path}`,
        );
  }

  /** A page of the enrolled teams; waits while no tournament is picked */
  list(
    tournamentId: Signal<number | undefined>,
    query: Signal<RegistrationsQuery>,
  ) {
    return paginatedResource<Registration, RegistrationsQuery>(
      () => this.url(tournamentId()),
      query,
      ({ search }): Record<string, string> => (search ? { search } : {}),
    );
  }

  /** Every enrolled team by name, unpaged (for pickers); waits while no tournament is picked */
  all(tournamentId: Signal<number | undefined>) {
    return httpResource<PaginatedResponse<Registration>>(() => {
      const url = this.url(tournamentId());

      return url === undefined
        ? undefined
        : { url, params: { skip_paging: true, sort: "name" } };
    });
  }

  /** League teams not enrolled in the tournament yet (banned ones included) */
  available(tournamentId: number, search: Signal<string>) {
    return paginatedResource<
      AvailableTeam,
      { search: string; page: number; pageSize: number; sort: string }
    >(
      () => this.url(tournamentId, "/available-teams"),
      computed(() => ({
        search: search(),
        page: 0,
        pageSize: AVAILABLE_PAGE_SIZE,
        sort: "name",
      })),
      ({ search: term }): Record<string, string> =>
        term ? { search: term } : {},
    );
  }

  register(tournamentId: number, teamIds: number[]) {
    return this.http.post<unknown>(
      this.url(tournamentId) ?? "",
      { team_ids: teamIds },
      this.ownErrors,
    );
  }

  remove(tournamentId: number, registrationId: number) {
    return this.http.delete<void>(
      this.url(tournamentId, `/${registrationId}`) ?? "",
      this.ownErrors,
    );
  }

  /** What withdrawing the team would do; read when the dialog opens */
  withdrawPreview(tournamentId: number, registrationId: number) {
    return httpResource<WithdrawPreview>(() =>
      this.url(tournamentId, `/${registrationId}/withdraw/preview`),
    );
  }

  /** Teams that held the registration before, with why and who changed them */
  teamChanges(tournamentId: number, registrationId: number) {
    return httpResource<{ data: TeamChange[] }>(() =>
      this.url(tournamentId, `/${registrationId}/team-changes`),
    );
  }

  withdraw(tournamentId: number, registrationId: number, reason: string) {
    return this.http.post<WithdrawResult>(
      this.url(tournamentId, `/${registrationId}/withdraw`) ?? "",
      { reason: reason.trim() },
      this.ownErrors,
    );
  }

  replace(
    tournamentId: number,
    registrationId: number,
    teamId: number,
    reason: string,
  ) {
    return this.http.post<ReplaceResult>(
      this.url(tournamentId, `/${registrationId}/replace`) ?? "",
      { team_id: teamId, reason: reason.trim() },
      this.ownErrors,
    );
  }
}
