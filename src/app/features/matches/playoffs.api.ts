import { HttpClient, HttpContext, httpResource } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { Bracket, CloseBody, ClosePreview } from "./playoff.model";

/**
 * Closing of the regular phase and the playoff bracket of a tournament of the
 * active league. Writes skip the generic error notification: the dialog or the
 * page shows the backend's message itself.
 */
@Service()
export class PlayoffsApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  private url(tournamentId: number, path: string): string {
    return this.league.leagueApi(`/tournaments/${tournamentId}${path}`) ?? "";
  }

  /** What closing would do: what blocks it, warnings and the proposed bracket of each playoff */
  preview(tournamentId: number) {
    return this.http.get<ClosePreview>(
      this.url(tournamentId, "/close-regular-phase/preview"),
      this.ownErrors,
    );
  }

  /** Closes the regular phase and moves the tournament to its playoffs; answers the tournament */
  close(tournamentId: number, body: CloseBody) {
    return this.http.post<unknown>(
      this.url(tournamentId, "/close-regular-phase"),
      body,
      this.ownErrors,
    );
  }

  /** Orders a set of tied best-of-position candidates by team id, best first; answers the preview again */
  saveBestManualOrder(
    tournamentId: number,
    sourceId: number,
    teamIds: number[],
  ) {
    return this.http.put<ClosePreview>(
      this.url(tournamentId, `/playoff-sources/${sourceId}/manual-order`),
      { team_ids: teamIds },
      this.ownErrors,
    );
  }

  clearBestManualOrder(tournamentId: number, sourceId: number) {
    return this.http.delete<void>(
      this.url(tournamentId, `/playoff-sources/${sourceId}/manual-order`),
      this.ownErrors,
    );
  }

  /** The bracket of every playoff; waits while `tournamentId` is undefined (the tournament is not in its playoffs) */
  bracket(tournamentId: Signal<number | undefined>) {
    return httpResource<Bracket>(() => {
      const id = tournamentId();

      return id === undefined
        ? undefined
        : (this.league.leagueApi(`/tournaments/${id}/playoffs`) ?? undefined);
    });
  }
}
