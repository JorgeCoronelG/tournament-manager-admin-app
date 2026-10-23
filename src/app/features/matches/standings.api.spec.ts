import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { StandingsApi } from "./standings.api";

const URL = "/api/leagues/3/tournaments/7/standings/manual-order";

describe("StandingsApi", () => {
  let api: StandingsApi;
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

    api = TestBed.inject(StandingsApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("saves the order of a tied set, best first", () => {
    api.saveManualOrder(7, 2, [5, 4]).subscribe();

    const request = controller.expectOne(URL);
    expect(request.request.method).toBe("PUT");
    expect(request.request.body).toEqual({
      group_id: 2,
      registration_ids: [5, 4],
    });
    expect(request.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    request.flush({ groups: [] });
  });

  it("removes the manual order of one group", () => {
    api.clearManualOrder(7, 2).subscribe();

    const request = controller.expectOne(`${URL}?group_id=2`);
    expect(request.request.method).toBe("DELETE");
    request.flush(null, { status: 204, statusText: "No Content" });
  });
});
