import { computed, Service, signal } from "@angular/core";
import { writeActiveLeagueId } from "../league-context/league-context.storage";
import { capabilitiesFor, Capability } from "../auth/role-capabilities";
import { Role } from "../auth/role.model";

export interface AppUser {
  id: number;
  name: string;
  role: string;
  roles: readonly Role[];
  avatarUrl: string | null;
}

const ANONYMOUS_USER: AppUser = {
  id: 0,
  name: "Guest",
  role: "",
  roles: [],
  avatarUrl: null,
};

/**
 * Holds the user shown in the sidenav and the toolbar, and what their roles
 * allow. `AuthSessionService` and the login call `setUser()` after signing in;
 * `clear()` runs when the session ends (sign out or an invalid token), and
 * forgets the league they had chosen so the next sign-in picks one again.
 */
@Service()
export class CurrentUserService {
  private readonly _user = signal<AppUser>(ANONYMOUS_USER);
  readonly user = this._user.asReadonly();

  readonly capabilities = computed(() => capabilitiesFor(this._user().roles));

  can(capability: Capability): boolean {
    return this.capabilities().has(capability);
  }

  setUser(user: AppUser): void {
    this._user.set(user);
  }

  clear(): void {
    const { id } = this._user();

    if (id > 0) {
      writeActiveLeagueId(id, null);
    }

    this._user.set(ANONYMOUS_USER);
  }
}
