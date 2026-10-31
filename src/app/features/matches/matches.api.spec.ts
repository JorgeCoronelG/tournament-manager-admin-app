import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ApplicationRef, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { MatchesApi } from "./matches.api";

const URL = "/api/leagues/3/tournaments/7/matches";

describe("MatchesApi", () => {
  let api: MatchesApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LeagueContextService,
          useValue: { leagueApi: (path: string) => `/api/leagues/3${path}` },
        },
      ],
    });

    api = TestBed.inject(MatchesApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("loads the schedule of the tournament, and waits without one", async () => {
    const id = signal<number | undefined>(undefined);
    const resource = TestBed.runInInjectionContext(() => api.schedule(id));
    await TestBed.inject(ApplicationRef).whenStable();
    controller.expectNone(`${URL}/schedule`);

    id.set(7);
    TestBed.tick();
    controller
      .expectOne(`${URL}/schedule`)
      .flush({ generated: false, groups: [] });
    await TestBed.inject(ApplicationRef).whenStable();

    expect(resource.value()).toEqual({ generated: false, groups: [] });
  });

  it("generates with the shuffle option and keeps its errors for the caller", () => {
    api.generate(7, false).subscribe();

    const request = controller.expectOne(`${URL}/generate`);
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual({ shuffle: false });
    expect(request.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    request.flush({ groups: [], total_matches: 0 });
  });

  it("deletes the calendar", () => {
    api.remove(7).subscribe();

    const request = controller.expectOne(URL);
    expect(request.request.method).toBe("DELETE");
    request.flush(null, { status: 204, statusText: "No Content" });
  });

  it("captures and voids a result, keeping the errors for the dialog", () => {
    api.setResult(7, 5, 2, 1).subscribe();
    const patch = controller.expectOne(`${URL}/5/result`);
    expect(patch.request.method).toBe("PATCH");
    expect(patch.request.body).toEqual({ home_goals: 2, away_goals: 1 });
    expect(patch.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    patch.flush({});

    api.setResult(7, 6, 1, 1, { home: 4, away: 3 }).subscribe();
    const pens = controller.expectOne(`${URL}/6/result`);
    expect(pens.request.body).toEqual({
      home_goals: 1,
      away_goals: 1,
      home_penalties: 4,
      away_penalties: 3,
    });
    pens.flush({});

    api.clearResult(7, 5).subscribe();
    const remove = controller.expectOne(`${URL}/5/result`);
    expect(remove.request.method).toBe("DELETE");
    remove.flush({});
  });

  it("registers a default win, sending the reason only when there is one", () => {
    api.walkover(7, 5, 21, "").subscribe();
    const bare = controller.expectOne(`${URL}/5/walkover`);
    expect(bare.request.method).toBe("POST");
    expect(bare.request.body).toEqual({ loser_registration_id: 21 });
    expect(bare.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    bare.flush({});

    api.walkover(7, 6, 22, " No llegó ").subscribe();
    const reasoned = controller.expectOne(`${URL}/6/walkover`);
    expect(reasoned.request.body).toEqual({
      loser_registration_id: 22,
      reason: "No llegó",
    });
    reasoned.flush({});
  });
});
