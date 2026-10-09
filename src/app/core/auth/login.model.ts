export interface LoginModel {
  email: string;
  password: string;
  rememberMe: boolean;
}

/** Which app is signing in; the backend only lets administrators into the web panel */
export type LoginClient = "web";

/** Body of POST /login */
export interface LoginRequest {
  email: string;
  password: string;
  client: LoginClient;
}
