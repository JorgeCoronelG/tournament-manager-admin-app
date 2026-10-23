import { HttpClient, HttpContext } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { forkJoin, map, Observable, of, switchMap } from "rxjs";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import {
  Group,
  GroupAssignment,
  GroupBody,
  GroupsOverview,
  GroupsView,
  GroupTeam,
  RegularGroup,
} from "./group.model";

/**
 * Groups and playoffs of a tournament of the active league
 * (`/leagues/{id}/tournaments/{id}/groups`; the backend authorizes them).
 * Writes skip the generic error notification: dialogs map 422 errors to their
 * fields and the page reports the rest itself.
 */
@Service()
export class GroupsApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  /** Endpoint URL; waits (undefined) while there is no league */
  private url(tournamentId: number, path = ""): string | undefined {
    return this.league.leagueApi(`/tournaments/${tournamentId}/groups${path}`);
  }

  /**
   * The groups of a tournament with the teams of each regular one (the list
   * only counts them, so each group's detail is requested too). Waits while no
   * tournament is picked and requests again when it changes.
   */
  view(tournamentId: Signal<number | undefined>) {
    return rxResource<GroupsView | undefined, string | undefined>({
      params: () => {
        const id = tournamentId();

        return id === undefined ? undefined : this.url(id);
      },
      stream: ({ params: url }) => this.load(url as string),
    });
  }

  private load(url: string): Observable<GroupsView> {
    return this.http.get<GroupsOverview>(url).pipe(
      switchMap((overview) => {
        const regular = overview.groups.filter(
          ({ type }) => type === "regular_stage",
        );
        const detailed = regular.map((group) =>
          group.teams_count === 0
            ? of<RegularGroup>({ ...group, teams: [] })
            : this.http
                .get<Group & { teams: GroupTeam[] }>(`${url}/${group.id}`)
                .pipe(map((detail) => ({ ...group, teams: detail.teams }))),
        );

        return (detailed.length ? forkJoin(detailed) : of([])).pipe(
          map((groups): GroupsView => ({
            regular: groups,
            playoffs: overview.groups.filter(({ type }) => type === "playoff"),
            unassigned: overview.unassigned,
            finalsAligned: overview.finals_aligned,
          })),
        );
      }),
    );
  }

  create(tournamentId: number, body: GroupBody) {
    return this.http.post<Group>(
      this.url(tournamentId) ?? "",
      body,
      this.ownErrors,
    );
  }

  update(tournamentId: number, groupId: number, body: GroupBody) {
    return this.http.patch<Group>(
      this.url(tournamentId, `/${groupId}`) ?? "",
      body,
      this.ownErrors,
    );
  }

  remove(tournamentId: number, groupId: number) {
    return this.http.delete<void>(
      this.url(tournamentId, `/${groupId}`) ?? "",
      this.ownErrors,
    );
  }

  /** Moves teams between groups at once; `group_id: null` leaves a team without group */
  assign(tournamentId: number, assignments: GroupAssignment[]) {
    return this.http.put<GroupsOverview>(
      this.url(tournamentId, "/assignments") ?? "",
      { assignments },
      this.ownErrors,
    );
  }

  /** Replaces the assignment: every active team is spread evenly at random */
  randomAssignment(tournamentId: number) {
    return this.http.post<GroupsOverview>(
      this.url(tournamentId, "/random-assignment") ?? "",
      {},
      this.ownErrors,
    );
  }
}
