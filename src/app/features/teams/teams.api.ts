import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  httpResource,
} from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { catchError, Observable, throwError } from "rxjs";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { paginatedResource } from "../../core/http/paginated-resource";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import {
  ManagerInput,
  ManagerLookup,
  NewManager,
  NewTeam,
  Team,
  TeamManagerOption,
  TeamStatus,
  TeamsQuery,
} from "./team.model";

const MANAGER_PREFIX = "manager.";

/**
 * The backend takes an existing delegate as `manager_user_code` and a new one
 * as `manager { first_name, ... }`, never both.
 */
function managerBody(manager: ManagerInput | undefined) {
  if (!manager) {
    return {};
  }

  return "user_code" in manager
    ? { manager_user_code: manager.user_code }
    : { manager };
}

/**
 * The backend names the delegate's fields `manager.email`...; the forms name
 * them `email`. Drops the prefix of a 422 so each error lands on its field.
 */
function withoutManagerPrefix<T>(source: Observable<T>): Observable<T> {
  return source.pipe(
    catchError((error: unknown) => {
      const body: unknown =
        error instanceof HttpErrorResponse && error.status === 422
          ? error.error
          : null;
      const errors =
        body && typeof body === "object"
          ? (body as { error?: unknown }).error
          : null;

      if (!errors || typeof errors !== "object" || Array.isArray(errors)) {
        return throwError(() => error);
      }

      const renamed = Object.fromEntries(
        Object.entries(errors).map(([field, messages]) => [
          field.startsWith(MANAGER_PREFIX)
            ? field.slice(MANAGER_PREFIX.length)
            : field,
          messages,
        ]),
      );

      return throwError(
        () =>
          new HttpErrorResponse({
            error: { ...(body as object), error: renamed },
            status: 422,
            statusText: (error as HttpErrorResponse).statusText,
            url: (error as HttpErrorResponse).url ?? undefined,
          }),
      );
    }),
  );
}

/**
 * Teams of the active league (`/leagues/{id}/teams`; the backend authorizes
 * them), with their delegate and logo. Requests skip the generic error
 * notification: the dialogs map 422 errors to their fields and report the rest
 * themselves.
 */
@Service()
export class TeamsApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  /** Endpoint URL; writes only happen with a league active */
  private url(path = ""): string {
    return this.league.leagueApi(`/teams${path}`) ?? "";
  }

  /**
   * A page of teams of the active league. Waits while there is none and
   * requests again when it changes. Empty filters are not sent.
   */
  list(query: Signal<TeamsQuery>) {
    return paginatedResource<Team, TeamsQuery>(
      () => this.league.leagueApi("/teams"),
      query,
      ({ search, status, manager }) => ({
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        ...(manager === "none" ? { has_manager: "false" } : {}),
        ...(typeof manager === "number" ? { manager_user_id: manager } : {}),
      }),
    );
  }

  /**
   * The delegates the league's teams have (each once, by name): the options of
   * the delegate filter. Waits while there is no league.
   */
  managers() {
    return httpResource<TeamManagerOption[]>(() =>
      this.league.leagueApi("/teams/managers"),
    );
  }

  /**
   * Looks a delegate up by their code. Waits while the code is empty; a 404
   * means "no eligible delegate" and a 429 "too many lookups".
   */
  lookupManager(userCode: Signal<string>) {
    return httpResource<ManagerLookup>(() => {
      const code = userCode();
      const url = this.league.leagueApi("/teams/manager-lookup");

      return code && url
        ? {
            url,
            params: { user_code: code },
            context: this.ownErrors.context,
          }
        : undefined;
    });
  }

  /** With a new delegate, they get an activation email */
  create(team: NewTeam) {
    return withoutManagerPrefix(
      this.http.post<Team>(
        this.url(),
        { name: team.name, ...managerBody(team.manager) },
        this.ownErrors,
      ),
    );
  }

  update(id: number, team: { name: string }) {
    return this.http.put<Team>(this.url(`/${id}`), team, this.ownErrors);
  }

  /** Bans or reactivates the team */
  setStatus(id: number, status: TeamStatus) {
    return this.http.patch<Team>(
      this.url(`/${id}/status`),
      { status },
      this.ownErrors,
    );
  }

  remove(id: number) {
    return this.http.delete<void>(this.url(`/${id}`), this.ownErrors);
  }

  /** Sets or replaces the logo; the browser sets the multipart Content-Type */
  uploadLogo(id: number, file: File) {
    const body = new FormData();
    body.append("logo", file);

    return this.http.post<Team>(this.url(`/${id}/logo`), body, this.ownErrors);
  }

  removeLogo(id: number) {
    return this.http.delete<void>(this.url(`/${id}/logo`), this.ownErrors);
  }

  /** Assigns the delegate (replacing the current one, if any) */
  setManager(id: number, manager: ManagerInput) {
    return withoutManagerPrefix(
      this.http.put<Team>(
        this.url(`/${id}/manager`),
        managerBody(manager),
        this.ownErrors,
      ),
    );
  }

  /** Only while their account is pending and they belong to this team alone */
  updateManager(id: number, manager: NewManager) {
    return this.http.patch<Team>(
      this.url(`/${id}/manager`),
      manager,
      this.ownErrors,
    );
  }

  removeManager(id: number) {
    return this.http.delete<void>(this.url(`/${id}/manager`), this.ownErrors);
  }

  /** Only for pending accounts */
  resendInvitation(id: number) {
    return this.http.post<{ message?: string }>(
      this.url(`/${id}/manager/resend-invitation`),
      {},
      this.ownErrors,
    );
  }
}
