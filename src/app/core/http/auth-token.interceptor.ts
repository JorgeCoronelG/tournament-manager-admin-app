import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { AuthTokenService } from "../auth/auth-token.service";

/** Attaches the bearer token issued on login, when there is one */
export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthTokenService).token();

  if (!token) {
    return next(request);
  }

  return next(
    request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};
