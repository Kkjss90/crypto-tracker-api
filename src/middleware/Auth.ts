import type {RequestHandler, Response} from 'express';
import {UnauthorizedError} from "../error/UnauthorizedError";
import {Logger} from "../utils/Logger";
import {AuthService} from "../service/AuthService";
import {Principal} from "../model/Principal";

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

function reject(res: Response, reason: string): UnauthorizedError {
  res.setHeader('WWW-Authenticate', 'Bearer');
  Logger.warn('Authentication failed', {requestId: res.locals.requestId, reason});
  return new UnauthorizedError('Invalid or missing API key');
}

export function createAuthMiddleware(authService: AuthService): RequestHandler {
  return (req, res, next) => {
    const header = req.headers.authorization;
    const token = header?.match(BEARER_PATTERN)?.[1];

    if (!token) {
      next(reject(res, header ? 'malformed header' : 'missing header'));
      return;
    }

    const result = authService.authenticate(token);
    if (!result.ok) {
      next(reject(res, result.reason));
      return;
    }

    res.locals.auth = result.principal;
    next();
  };
}

export function getPrincipal(res: Response): Principal {
  const principal = res.locals.auth as Principal | undefined;
  if (!principal) {
    throw new UnauthorizedError('Invalid or missing API key');
  }
  return principal;

}
