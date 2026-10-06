import type {ErrorRequestHandler} from 'express';
import {AppError} from "../error/AppError";
import {Logger} from '../utils/Logger';
import {ValidationError} from "../error/ValidationError";
import {InternalServerError} from "../error/InternalServerError";

function isJsonSyntaxError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed';
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (isJsonSyntaxError(err)) return new ValidationError('Request body is not valid JSON');
  return new InternalServerError();
}

export const ErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const appError = toAppError(err);

  if (appError.isServerError) {
    Logger.error('Server error', {
      method: req.method,
      path: req.path,
      code: appError.code,
      error: err instanceof Error ? err.stack : String(err),
    });
  }

  res.status(appError.statusCode).json({
    error: {code: appError.code, message: appError.message, details: appError.details},
  });
};
