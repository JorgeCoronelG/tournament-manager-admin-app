export interface AuthenticatedRole {
  id: number;
  code: string;
  name: string;
}

export interface AuthenticatedUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  photo_url: string;
  /** A user can have several roles; `code` is the stable identifier */
  roles: AuthenticatedRole[];
}

export interface LoginResponse {
  user: AuthenticatedUser;
  token: string;
  token_type: string;
}
