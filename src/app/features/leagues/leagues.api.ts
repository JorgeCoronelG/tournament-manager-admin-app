import { HttpClient, HttpContext, httpResource } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { paginatedResource } from "../../core/http/paginated-resource";
import { PaginatedResponse } from "../../core/http/paginated-response.model";
import { SettingsService } from "../../core/settings/settings.service";
import { User } from "../users/user.model";
import { League, LeaguesQuery, NewLeague } from "./league.model";

/** How many candidates the manager selector asks for */
const ADMIN_CANDIDATES = 20;

/**
 * Leagues endpoints (superadmin only; the backend authorizes them). Writes skip
 * the generic error notification: the form maps 422 errors to its fields and
 * reports the rest itself.
 */
@Service()
export class LeaguesApi {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  private url(path: string): string {
    return this.settings.authApi(path);
  }

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  /** A page of leagues. Empty filters are not sent; the total is `meta.total`. */
  list(query: Signal<LeaguesQuery>) {
    return paginatedResource<League, LeaguesQuery>(
      () => this.url("/leagues"),
      query,
      ({ search, adminUserId }) => ({
        ...(search ? { search } : {}),
        ...(adminUserId !== "" ? { admin_user_id: adminUserId } : {}),
      }),
    );
  }

  get(id: number) {
    return this.http.get<League>(this.url(`/leagues/${id}`));
  }

  create(league: NewLeague) {
    return this.http.post<League>(this.url("/leagues"), league, this.ownErrors);
  }

  update(id: number, league: NewLeague) {
    return this.http.put<League>(
      this.url(`/leagues/${id}`),
      league,
      this.ownErrors,
    );
  }

  remove(id: number) {
    return this.http.delete<void>(this.url(`/leagues/${id}`), this.ownErrors);
  }

  /**
   * Users that can manage a league (role `league_admin`) matching the search
   * text. Stays idle until the role id is known.
   */
  adminCandidates(roleId: Signal<number | undefined>, search: Signal<string>) {
    return httpResource<PaginatedResponse<User>>(() => {
      const role = roleId();

      return role === undefined
        ? undefined
        : {
            url: this.url("/users"),
            params: {
              role_id: role,
              per_page: ADMIN_CANDIDATES,
              ...(search() ? { search: search() } : {}),
            },
          };
    });
  }
}
