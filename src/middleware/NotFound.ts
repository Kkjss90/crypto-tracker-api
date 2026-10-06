import type { RequestHandler } from 'express';
import {NotFoundError} from "../error/NotFoundError";

export const NotFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
};
