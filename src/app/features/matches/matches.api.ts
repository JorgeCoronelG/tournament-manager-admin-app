import { HttpClient, HttpContext, httpResource } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { GenerateResult, Match, Schedule } from "./match.model";

/**
 * Regular-phase calendar of a tournament of the active league
 * (`/leagues/{id}/tournaments/{id}/matches`; the backend authorizes it).
 * Writes skip the generic error notification: the dialog or the page shows the
 * backend's message itself.
 */
@Service()
export class MatchesApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  private url(tournamentId: number, path = ""): string | undefined {
    return this.league.leagueApi(`/tournaments/${tournamentId}/matches${path}`);
  }

  /** The calendar; waits while `tournamentId` is undefined (no tournament, or one that cannot have it yet) */
  schedule(tournamentId: Signal<number | undefined>) {
    return httpResource<Schedule>(() => {
      const id = tournamentId();

      return id === undefined ? undefined : this.url(id, "/schedule");
    });
  }

  /** Replaces the calendar; `shuffle` draws the order of the teams first */
  generate(tournamentId: number, shuffle: boolean) {
    return this.http.post<GenerateResult>(
      this.url(tournamentId, "/generate") ?? "",
      { shuffle },
      this.ownErrors,
    );
  }

  /** Captures the score of a match (it becomes played) */
  setResult(
    tournamentId: number,
    matchId: number,
    homeScore: number,
    awayScore: number,
  ) {
    return this.http.patch<Match>(
      this.url(tournamentId, `/${matchId}/result`) ?? "",
      { home_score: homeScore, away_score: awayScore },
      this.ownErrors,
    );
  }

  /** Voids the score: the match goes back to scheduled */
  clearResult(tournamentId: number, matchId: number) {
    return this.http.delete<Match>(
      this.url(tournamentId, `/${matchId}/result`) ?? "",
      this.ownErrors,
    );
  }

  remove(tournamentId: number) {
    return this.http.delete<void>(this.url(tournamentId) ?? "", this.ownErrors);
  }
}
