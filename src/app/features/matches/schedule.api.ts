import { HttpClient, HttpContext } from "@angular/common/http";
import { inject, Service } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import {
  ClearResult,
  SchedulePhase,
  SchedulePreview,
  ScheduleOptions,
} from "./schedule.model";

/**
 * Assigns day, hour and field to the matches of a tournament of the active
 * league (`/leagues/{id}/tournaments/{id}/schedule`; the backend authorizes
 * it). Skips the generic error notification: the caller shows the message.
 */
@Service()
export class ScheduleApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  private url(tournamentId: number, path = ""): string {
    return (
      this.league.leagueApi(`/tournaments/${tournamentId}/schedule${path}`) ??
      ""
    );
  }

  /** What generating would do, without saving it */
  preview(tournamentId: number, options: ScheduleOptions) {
    return this.http.post<SchedulePreview>(
      this.url(tournamentId, "/preview"),
      options,
      this.ownErrors,
    );
  }

  generate(tournamentId: number, options: ScheduleOptions) {
    return this.http.post<SchedulePreview>(
      this.url(tournamentId, "/generate"),
      options,
      this.ownErrors,
    );
  }

  /** Takes the date, hour and field off the matches that are neither played nor locked */
  clear(tournamentId: number, phase: SchedulePhase = "regular") {
    return this.http.delete<ClearResult>(
      this.url(tournamentId, phase === "playoffs" ? "?phase=playoffs" : ""),
      this.ownErrors,
    );
  }
}
