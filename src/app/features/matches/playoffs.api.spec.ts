import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import { PlayoffsApi } from "./playoffs.api";

const URL = "/api/leagues/3/tournaments/7";

describe("PlayoffsApi", () => {
  let api: PlayoffsApi;
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

    api = TestBed.inject(PlayoffsApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("asks what closing the regular phase would do, keeping errors for the dialog", () => {
    api.preview(7).subscribe();

    const request = controller.expectOne(`${URL}/close-regular-phase/preview`);
    expect(request.request.method).toBe("GET");
    expect(request.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    request.flush({ blockers: [], warnings: [], playoffs: [] });
  });

  it("closes the phase with the confirmed pairings and dates", () => {
    const body = {
      liguillas: [{ group_id: 10, ties: [], round_dates: ["2026-12-07"] }],
    };
    api.close(7, body).subscribe();

    const request = controller.expectOne(`${URL}/close-regular-phase`);
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual(body);
    request.flush({});
  });

  it("orders and unorders the tied candidates of a best-of-position source", () => {
    api.saveBestManualOrder(7, 5, [30, 10]).subscribe();
    const put = controller.expectOne(`${URL}/playoff-sources/5/manual-order`);
    expect(put.request.method).toBe("PUT");
    expect(put.request.body).toEqual({ team_ids: [30, 10] });
    put.flush({ blockers: [], warnings: [], playoffs: [] });

    api.clearBestManualOrder(7, 5).subscribe();
    const remove = controller.expectOne(
      `${URL}/playoff-sources/5/manual-order`,
    );
    expect(remove.request.method).toBe("DELETE");
    remove.flush(null, { status: 204, statusText: "No Content" });
  });
});
