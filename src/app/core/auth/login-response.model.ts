export interface AuthenticatedUser {
  id: number;
  name: string;
  surnames: string;
  email: string;
  photo_url: string;
}

export interface LoginResponse {
  user: AuthenticatedUser;
  token: string;
  token_type: string;
}
