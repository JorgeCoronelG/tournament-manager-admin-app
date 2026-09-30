import { computed, Service, signal } from "@angular/core";
import { capabilitiesFor, Capability } from "../auth/role-capabilities";
import { Role } from "../auth/role.model";

export interface AppUser {
  name: string;
  role: string;
  roles: readonly Role[];
  avatarUrl: string | null;
}

const ANONYMOUS_USER: AppUser = {
  name: "Guest",
  role: "",
  roles: [],
  avatarUrl: null,
};

/**
 * Holds the user shown in the sidenav and the toolbar, and what their roles
 * allow. `AuthSessionService` and the login call `setUser()` after signing in;
 * `clear()` runs when the session ends.
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
    this._user.set(ANONYMOUS_USER);
  }
}
