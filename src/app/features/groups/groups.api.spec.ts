import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ApplicationRef, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { Group, GroupsOverview, GroupTeam } from "./group.model";
import { GroupsApi } from "./groups.api";

const URL = "/api/leagues/3/tournaments/7/groups";

const regular = (id: number, teams_count: number): Group => ({
  id,
  name: `Grupo ${id}`,
  type: "regular_stage",
  teams_count,
});

const teamOf = (id: number): GroupTeam => ({
  id,
  team: {
    id: id * 10,
    name: `Equipo ${id}`,
    logo_url: null,
    manager: null,
  },
});

describe("GroupsApi", () => {
  let api: GroupsApi;
  let controller: HttpTestingController;
  const leagueId = signal<number | null>(3);

  beforeEach(() => {
    leagueId.set(3);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LeagueContextService,
          useValue: {
            leagueApi: (path: string) =>
              leagueId() === null
                ? undefined
                : `/api/leagues/${leagueId()}${path}`,
          },
        },
      ],
    });

    api = TestBed.inject(GroupsApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("loads the groups with the teams of each regular one", async () => {
    const resource = TestBed.runInInjectionContext(() => api.view(signal(7)));
    TestBed.tick();

    const playoff: Group = {
      id: 9,
      name: "Oro",
      type: "playoff",
      teams_count: 0,
    };
    const overview: GroupsOverview = {
      groups: [regular(1, 2), regular(2, 0), playoff],
      unassigned: [teamOf(5)],
      finals_aligned: false,
    };
    controller.expectOne(URL).flush(overview);
    // Only the group with teams asks for its detail
    controller
      .expectOne(`${URL}/1`)
      .flush({ ...regular(1, 2), teams: [teamOf(1), teamOf(2)] });
    await TestBed.inject(ApplicationRef).whenStable();

    const view = resource.value();
    expect(view?.regular.map((group) => group.teams.length)).toEqual([2, 0]);
    expect(view?.playoffs).toEqual([playoff]);
    expect(view?.unassigned).toEqual([teamOf(5)]);
    expect(view?.finalsAligned).toBe(false);
  });

  it("waits without a tournament or a league", () => {
    TestBed.runInInjectionContext(() => api.view(signal(undefined)));
    leagueId.set(null);
    TestBed.runInInjectionContext(() => api.view(signal(7)));
    TestBed.tick();

    controller.expectNone(() => true);
  });

  it("writes under the tournament and skips the generic error notification", () => {
    const expectCall = (url: string, method: string, body: unknown) => {
      const request = controller.expectOne(url);
      expect(request.request.method).toBe(method);
      expect(request.request.body).toEqual(body);
      expect(request.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
      request.flush(null);
    };

    api.create(7, { name: "Grupo C" }).subscribe();
    expectCall(URL, "POST", { name: "Grupo C" });

    api.update(7, 2, { name: "Grupo Z" }).subscribe();
    expectCall(`${URL}/2`, "PATCH", { name: "Grupo Z" });

    api.remove(7, 2).subscribe();
    expectCall(`${URL}/2`, "DELETE", null);

    api.assign(7, [{ registration_id: 1, group_id: null }]).subscribe();
    expectCall(`${URL}/assignments`, "PUT", {
      assignments: [{ registration_id: 1, group_id: null }],
    });

    api.randomAssignment(7).subscribe();
    expectCall(`${URL}/random-assignment`, "POST", {});
  });
});
