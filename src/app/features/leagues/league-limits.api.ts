import { httpResource } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { SettingsService } from "../../core/settings/settings.service";
import { LeagueLimits } from "./league.model";

/** The limits of a league and how much of them it uses (`GET /leagues/{id}/limits`) */
@Service()
export class LeagueLimitsApi {
  private readonly league = inject(LeagueContextService);
  private readonly settings = inject(SettingsService);

  /** The limits of the active league; waits while there is none */
  ofActiveLeague() {
    return httpResource<LeagueLimits>(() => this.league.leagueApi("/limits"));
  }

  /** The limits of any league (the superadmin's form); waits while `id` is undefined */
  ofLeague(id: Signal<number | undefined>) {
    return httpResource<LeagueLimits>(() => {
      const leagueId = id();

      return leagueId === undefined
        ? undefined
        : this.settings.authApi(`/leagues/${leagueId}/limits`);
    });
  }
}
