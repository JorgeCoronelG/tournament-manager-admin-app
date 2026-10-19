import { HttpClient, HttpContext } from "@angular/common/http";
import { inject, Service, Signal } from "@angular/core";
import { SKIP_ERROR_NOTIFICATION } from "../../core/http/error.interceptor";
import { paginatedResource } from "../../core/http/paginated-resource";
import { LeagueContextService } from "../../core/league-context/league-context.service";
import {
  Field,
  FieldChanges,
  FieldsQuery,
  FieldStatus,
  NewField,
} from "./field.model";

/**
 * Fields of the active league (`/leagues/{id}/fields`; the backend authorizes
 * them). Writes skip the generic error notification: the form maps 422 errors
 * to its fields and reports the rest itself.
 */
@Service()
export class FieldsApi {
  private readonly http = inject(HttpClient);
  private readonly league = inject(LeagueContextService);

  private readonly ownErrors = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  /** Endpoint URL; writes only happen with a league active */
  private url(path = ""): string {
    return this.league.leagueApi(`/fields${path}`) ?? "";
  }

  /**
   * A page of fields of the active league. Waits while there is none and
   * requests again when it changes. Empty filters are not sent.
   */
  list(query: Signal<FieldsQuery>) {
    return paginatedResource<Field, FieldsQuery>(
      () => this.league.leagueApi("/fields"),
      query,
      ({ search, status }) => ({
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      }),
    );
  }

  create(field: NewField) {
    return this.http.post<Field>(this.url(), field, this.ownErrors);
  }

  update(id: number, field: FieldChanges) {
    return this.http.put<Field>(this.url(`/${id}`), field, this.ownErrors);
  }

  setStatus(id: number, status: FieldStatus) {
    return this.http.patch<Field>(
      this.url(`/${id}/status`),
      { status },
      this.ownErrors,
    );
  }

  remove(id: number) {
    return this.http.delete<void>(this.url(`/${id}`), this.ownErrors);
  }
}
