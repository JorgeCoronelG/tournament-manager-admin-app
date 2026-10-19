import { PageQuery } from "../../core/http/paginated-resource";

export type FieldStatus = "active" | "inactive";

export const FIELD_STATUSES: readonly FieldStatus[] = ["active", "inactive"];

/** A field (cancha) of the active league, as the endpoints return it */
export interface Field {
  id: number;
  league_id: number;
  name: string;
  status: FieldStatus;
  /** ISO 8601 date */
  created_at: string;
}

/** Body of POST /fields; the status is only sent when creating */
export interface NewField {
  name: string;
  status?: FieldStatus;
}

/** Body of PUT /fields/{id} */
export type FieldChanges = Pick<NewField, "name">;

export type FieldSortField = "name" | "created_at";

export interface FieldsFilters {
  search: string;
  status: FieldStatus | "";
}

export type FieldsQuery = FieldsFilters & PageQuery;
