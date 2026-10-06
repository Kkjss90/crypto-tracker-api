import type {ErrorRequestHandler} from 'express';
import {ValidationError} from "../error/ValidationError";
import {InternalServerError} from "../error/InternalServerError";
import {AppError} from "../error/AppError";
import {Logger} from "../utils/Logger";

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
    Logger.error(
      'Server error',
      {
        requestId: res.locals.requestId,
        method: req.method,
        path: req.path,
        code: appError.code,
      },
      err,
    );
  }

  res.status(appError.statusCode).json({
    error: {code: appError.code, message: appError.message, details: appError.details},
  });
};
