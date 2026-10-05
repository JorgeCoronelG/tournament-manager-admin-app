import { HttpClient, HttpContext, httpResource } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { paginatedResource } from "../../core/http/paginated-resource";
import { SettingsService } from "../../core/settings/settings.service";
import { NewUser, UpdatedUser, User, UserRole, UsersQuery } from "./user.model";

/**
 * Users management endpoints (superadmin only; the backend authorizes them).
 * Writes skip the generic error notification: the form maps 422 errors to its
 * fields and reports the rest itself.
 */
@Service()
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  private url(path: string): string {
    return this.settings.authApi(path);
  }

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  /** Roles that can be assigned (never superadmin) */
  roles() {
    return httpResource<UserRole[]>(() => this.url("/roles"));
  }

  /** A page of users. Empty filters are not sent; the total is `meta.total`. */
  list(query: Signal<UsersQuery>) {
    return paginatedResource<User, UsersQuery>(
      () => this.url("/users"),
      query,
      ({ search, roleId, status }) => ({
        ...(search ? { search } : {}),
        ...(roleId !== "" ? { role_id: roleId } : {}),
        ...(status ? { status } : {}),
      }),
    );
  }

  create(user: NewUser) {
    return this.http.post<User>(this.url("/users"), user, this.ownErrors);
  }

  update(id: number, user: UpdatedUser) {
    return this.http.put<User>(this.url(`/users/${id}`), user, this.ownErrors);
  }

  setStatus(id: number, isActive: boolean) {
    return this.http.patch<User>(
      this.url(`/users/${id}/status`),
      { is_active: isActive },
      this.ownErrors,
    );
  }

  remove(id: number) {
    return this.http.delete<void>(this.url(`/users/${id}`), this.ownErrors);
  }

  /** Only for pending users */
  resendInvitation(id: number) {
    return this.http.post<{ message?: string }>(
      this.url(`/users/${id}/resend-invitation`),
      {},
      this.ownErrors,
    );
  }
}
