import { HttpClient, HttpContext, httpResource } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { paginatedResource } from "../../core/http/paginated-resource";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import {
  NewReferee,
  Referee,
  RefereeLeagueStatus,
  RefereeLookup,
  RefereesQuery,
} from "./referee.model";

/**
 * Referees of the active league (`/leagues/{id}/referees`; the backend
 * authorizes them). Requests skip the generic error notification: the dialogs
 * map 422 errors to their fields and report the rest themselves.
 */
@Service()
export class RefereesApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  /** Endpoint URL; writes only happen with a league active */
  private url(path = ""): string {
    return this.league.leagueApi(`/referees${path}`) ?? "";
  }

  /**
   * A page of referees of the active league. Waits while there is none and
   * requests again when it changes. Empty filters are not sent.
   */
  list(query: Signal<RefereesQuery>) {
    return paginatedResource<Referee, RefereesQuery>(
      () => this.league.leagueApi("/referees"),
      query,
      ({ search, status }) => ({
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      }),
    );
  }

  /**
   * Looks a referee up by their code. Waits while the code is empty; a 404 means
   * "no eligible referee" and a 429 "too many lookups".
   */
  lookup(userCode: Signal<string>) {
    return httpResource<RefereeLookup>(() => {
      const code = userCode();
      const url = this.league.leagueApi("/referees/lookup");

      return code && url
        ? {
            url,
            params: { user_code: code },
            context: this.ownErrors.context,
          }
        : undefined;
    });
  }

  /** Creates the user and adds them to the league; they get an activation email */
  create(referee: NewReferee) {
    return this.http.post<Referee>(this.url(), referee, this.ownErrors);
  }

  /** Adds a referee that already exists in the system, by their code */
  attach(userCode: string) {
    return this.http.post<Referee>(
      this.url("/attach"),
      { user_code: userCode },
      this.ownErrors,
    );
  }

  /** Only while their account is pending and they belong to this league alone */
  update(id: number, referee: NewReferee) {
    return this.http.put<Referee>(this.url(`/${id}`), referee, this.ownErrors);
  }

  setStatus(id: number, status: RefereeLeagueStatus) {
    return this.http.patch<Referee>(
      this.url(`/${id}/status`),
      { status },
      this.ownErrors,
    );
  }

  /** Removes them from this league (their account stays) */
  remove(id: number) {
    return this.http.delete<void>(this.url(`/${id}`), this.ownErrors);
  }

  /** Only for pending accounts */
  resendInvitation(id: number) {
    return this.http.post<{ message?: string }>(
      this.url(`/${id}/resend-invitation`),
      {},
      this.ownErrors,
    );
  }
}
