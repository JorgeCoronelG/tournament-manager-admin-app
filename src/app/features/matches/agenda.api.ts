import { HttpClient, httpResource } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { map } from "rxjs";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { Agenda, AgendaQuery } from "./agenda.model";

/** Matches with hour of every tournament of the active league (`/leagues/{id}/agenda`; the backend authorizes it) */
@Service()
export class AgendaApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  /** The matches of a period; asked again when the query changes */
  agenda(query: Signal<AgendaQuery | undefined>) {
    return httpResource<Agenda>(() => {
      const current = query();
      const url = this.league.leagueApi("/agenda");

      if (!current || !url) {
        return undefined;
      }

      return {
        url,
        params: {
          date_from: current.from,
          date_to: current.to,
          ...(current.tournament !== "" && {
            tournament_id: current.tournament,
          }),
          ...(current.referee !== "" && { referee_user_id: current.referee }),
          ...(current.field !== "" && { field_id: current.field }),
          ...(current.noReferee && { unassigned_referee: 1 }),
        },
      };
    });
  }

  /** Matches of a tournament that still have no hour */
  unscheduled(tournamentId: number) {
    return this.http
      .get<{ unscheduled: number }>(
        this.league.leagueApi("/agenda/unscheduled") ?? "",
        { params: { tournament_id: tournamentId } },
      )
      .pipe(map((result) => result.unscheduled));
  }
}
