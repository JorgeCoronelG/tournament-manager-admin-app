export interface AuthenticatedUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  photo_url: string;
}

export interface LoginResponse {
  user: AuthenticatedUser;
  token: string;
  token_type: string;
}
