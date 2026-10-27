import { HttpClient, HttpContext, httpResource } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import {
  Capacity,
  ScheduleConfig,
  ScheduleConfigBody,
} from "./schedule-config.model";

/**
 * Play days, fields' windows and blocked dates of a tournament of the active
 * league (`/leagues/{id}/tournaments/{id}/schedule-config`; the backend
 * authorizes it). Writes skip the generic error notification: the dialog shows
 * the backend's messages itself.
 */
@Service()
export class ScheduleConfigApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  private url(tournamentId: number, path = ""): string | undefined {
    return this.league.leagueApi(
      `/tournaments/${tournamentId}/schedule-config${path}`,
    );
  }

  config(tournamentId: Signal<number | undefined>) {
    return httpResource<ScheduleConfig>(() => {
      const id = tournamentId();

      return id === undefined ? undefined : this.url(id);
    });
  }

  /** Slots the saved configuration gives; asked again with `reload()` */
  capacity(tournamentId: Signal<number | undefined>) {
    return httpResource<Capacity>(() => {
      const id = tournamentId();

      return id === undefined ? undefined : this.url(id, "/capacity");
    });
  }

  /** Capacity of a configuration that is not saved yet (the form's current values) */
  previewCapacity(tournamentId: number, config: ScheduleConfigBody) {
    return this.http.post<Capacity>(
      this.url(tournamentId, "/capacity") ?? "",
      config,
      this.ownErrors,
    );
  }

  save(tournamentId: number, config: ScheduleConfigBody) {
    return this.http.put<ScheduleConfig>(
      this.url(tournamentId) ?? "",
      config,
      this.ownErrors,
    );
  }
}
