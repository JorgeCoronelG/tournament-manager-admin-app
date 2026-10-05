import { PageQuery } from "../../core/http/paginated-resource";

export type UserStatus = "pending" | "active" | "inactive";

export interface UserRole {
  id: number;
  code: string;
  name: string;
}

/** A user as the management endpoints return it */
export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  user_code: string;
  photo_url: string | null;
  is_active: boolean;
  email_verified_at: string | null;
  status: UserStatus;
  roles: UserRole[];
  /** ISO 8601 date */
  created_at: string;
}

/** Body of POST /users; PUT /users/{id} also takes `is_active` */
export interface NewUser {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  /** Role ids */
  roles: number[];
}

export type UpdatedUser = NewUser & { is_active: boolean };

export type UserSortField = "first_name" | "last_name" | "created_at";

export interface UsersFilters {
  search: string;
  roleId: number | "";
  status: UserStatus | "";
}

export type UsersQuery = UsersFilters & PageQuery;
