import { HttpClient, HttpContext, httpResource } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { paginatedResource } from "../../core/http/paginated-resource";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import {
  BanResult,
  Player,
  PlayerDetail,
  PlayerGender,
  PlayersQuery,
} from "./player.model";

/**
 * Players of the active league (`/leagues/{id}/players`; the backend
 * authorizes them). They are read and moderated here, never created. Writes
 * skip the generic error notification: the dialogs show the backend's message
 * and the page reports the rest itself.
 */
@Service()
export class PlayersApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  private url(path = ""): string {
    return this.league.leagueApi(`/players${path}`) ?? "";
  }

  /** A page of players; waits while there is no league. Empty filters are not sent. */
  list(query: Signal<PlayersQuery>) {
    return paginatedResource<Player, PlayersQuery>(
      () => this.league.leagueApi("/players"),
      query,
      ({ search, gender, status }): Record<string, string> => ({
        ...(search ? { search } : {}),
        ...(gender ? { gender } : {}),
        ...(status ? { banned: String(status === "banned") } : {}),
      }),
    );
  }

  /** The player with their rosters and bans in this league */
  detail(playerId: number) {
    return httpResource<PlayerDetail>(() => this.url(`/${playerId}`));
  }

  changeGender(playerId: number, gender: PlayerGender) {
    return this.http.patch<Player>(
      this.url(`/${playerId}/gender`),
      { gender },
      this.ownErrors,
    );
  }

  ban(playerId: number, reason: string) {
    return this.http.post<BanResult>(
      this.url(`/${playerId}/ban`),
      { reason: reason.trim() },
      this.ownErrors,
    );
  }

  unban(playerId: number) {
    return this.http.post<Player>(
      this.url(`/${playerId}/unban`),
      {},
      this.ownErrors,
    );
  }
}
