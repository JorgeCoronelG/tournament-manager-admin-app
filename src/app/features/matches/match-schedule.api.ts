import { HttpClient, HttpContext, httpResource } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { Match } from "./match.model";
import {
  AvailableReferee,
  AvailableSlots,
  MatchScheduleBody,
  MatchWarning,
} from "./match-schedule.model";

/**
 * Day, hour, field and referee of one match
 * (`/leagues/{id}/matches/{id}/...`; the backend authorizes them). Writes skip
 * the generic error notification: the dialog shows the backend's messages.
 */
@Service()
export class MatchScheduleApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  private url(matchId: number, path: string): string {
    return this.league.leagueApi(`/matches/${matchId}/${path}`) ?? "";
  }

  /** Free slots of a day (Y-m-d); waits while there is no date */
  availableSlots(matchId: number, date: Signal<string | undefined>) {
    return httpResource<AvailableSlots>(() => {
      const day = date();

      return day === undefined
        ? undefined
        : `${this.url(matchId, "available-slots")}?date=${day}`;
    });
  }

  /** Referees with whether each is free at that moment (`Y-m-dTH:mm`); without a moment, only who plays in the match */
  availableReferees(matchId: number, datetime: Signal<string | undefined>) {
    return httpResource<{ referees: AvailableReferee[] }>(() => {
      const moment = datetime();
      const url = this.url(matchId, "available-referees");

      return moment === undefined
        ? url
        : `${url}?match_datetime=${encodeURIComponent(moment)}`;
    });
  }

  update(matchId: number, body: MatchScheduleBody) {
    return this.http.patch<Match & { warnings: MatchWarning[] }>(
      this.url(matchId, "schedule"),
      body,
      this.ownErrors,
    );
  }

  swap(matchId: number, withMatchId: number) {
    return this.http.post<{
      match: Match;
      with_match: Match;
      warnings: MatchWarning[];
    }>(
      this.url(matchId, "swap-schedule"),
      { with_match_id: withMatchId },
      this.ownErrors,
    );
  }
}
