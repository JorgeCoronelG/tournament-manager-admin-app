import { Service, signal } from "@angular/core";

export interface AppUser {
  name: string;
  role: string;
  avatarUrl: string;
}

const ANONYMOUS_USER: AppUser = {
  name: "Guest",
  role: "",
  avatarUrl: "assets/img/avatars/default.jpg",
};

/**
 * Holds the user shown in the sidenav and the toolbar. There is no
 * authentication yet: whoever adds it should call `setUser()` after signing in
 * and `clear()` after signing out.
 */
@Service()
export class CurrentUserService {
  private readonly _user = signal<AppUser>(ANONYMOUS_USER);
  readonly user = this._user.asReadonly();

  setUser(user: AppUser): void {
    this._user.set(user);
  }

  clear(): void {
    this._user.set(ANONYMOUS_USER);
  }
}
