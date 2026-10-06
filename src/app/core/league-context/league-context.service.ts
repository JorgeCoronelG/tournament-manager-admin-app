import { httpResource } from "@angular/common/http";
import { computed, inject, linkedSignal, Service } from "@angular/core";
import { SettingsService } from "../settings/settings.service";
import { PaginatedResponse } from "../http/paginated-response.model";
import { CurrentUserService } from "../user/current-user.service";
import {
  readActiveLeagueId,
  writeActiveLeagueId,
} from "./league-context.storage";
import { MyLeague } from "./my-league.model";

/** Enough for any league admin; the selector filters this list locally */
const PER_PAGE = 100;

/**
 * The league every league screen works in. It loads the leagues the user can
 * reach (only if they hold `leagues.select`) and decides which one is active:
 * the one they chose last time if it is still there, the only one they have, or
 * none, so screens ask them to pick. The first league is never assumed, to not
 * edit the wrong one by accident.
 */
@Service()
export class LeagueContextService {
  private readonly currentUser = inject(CurrentUserService);
  private readonly settings = inject(SettingsService);

  private readonly userId = computed(() => this.currentUser.user().id);
  private readonly enabled = computed(
    () => this.userId() > 0 && this.currentUser.can("leagues.select"),
  );

  // Reads again whenever the user changes, so ids never leak between users
  private readonly chosenId = linkedSignal<number, number | null>({
    source: this.userId,
    computation: (userId) => readActiveLeagueId(userId),
  });

  private readonly resource = httpResource<PaginatedResponse<MyLeague>>(() => {
    // Read here so a different user always loads their own leagues
    this.userId();

    return this.enabled()
      ? {
          url: this.settings.authApi("/my-leagues"),
          params: { page: 1, per_page: PER_PAGE },
        }
      : undefined;
  });

  readonly leagues = computed(() => this.resource.value()?.data ?? []);

  readonly activeLeague = computed<MyLeague | null>(() => {
    const leagues = this.leagues();

    return (
      leagues.find((league) => league.id === this.chosenId()) ??
      (leagues.length === 1 ? leagues[0] : null)
    );
  });
  readonly activeLeagueId = computed(() => this.activeLeague()?.id ?? null);

  readonly isLoading = this.resource.isLoading;
  readonly error = this.resource.error;

  /** Makes a league of the list the active one and remembers it for next time */
  select(id: number): void {
    if (!this.leagues().some((league) => league.id === id)) {
      return;
    }

    this.chosenId.set(id);
    writeActiveLeagueId(this.userId(), id);
  }

  /** Leaves no league active (and forgets the saved one); screens ask to pick again */
  clear(): void {
    this.chosenId.set(null);
    writeActiveLeagueId(this.userId(), null);
  }

  reload(): void {
    this.resource.reload();
  }

  /**
   * URL of an endpoint nested in the active league, e.g. `leagueApi("/teams")`.
   * `undefined` while there is no league: return it from an `httpResource` and
   * the request waits, then runs again when the league changes.
   */
  leagueApi(path: string): string | undefined {
    const id = this.activeLeagueId();

    return id === null
      ? undefined
      : this.settings.authApi(`/leagues/${id}${path}`);
  }

  /** Whether the URL belongs to the active league's nested endpoints */
  isActiveLeagueUrl(url: string): boolean {
    const base = this.leagueApi("/");

    return base !== undefined && url.startsWith(base);
  }
}
