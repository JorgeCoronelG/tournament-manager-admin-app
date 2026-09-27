export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
}

export interface LoginResponse {
  user: AuthenticatedUser;
  token: string;
  token_type: string;
}
