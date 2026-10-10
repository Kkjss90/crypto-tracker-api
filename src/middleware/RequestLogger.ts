import {randomUUID} from 'node:crypto';
import type {RequestHandler} from 'express';
import {Logger} from "../utils/Logger";

const SKIPPED_PREFIXES = ['/health', '/docs'];

export const requestLogger: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const isSkipped = (path: string): boolean =>
    SKIPPED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  if (isSkipped(req.path)) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  const path = req.path;
  Logger.debug('Request started', {requestId, method: req.method, path});

  res.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
    const meta = {
      requestId,
      method: req.method,
      path,
      status: res.statusCode,
      durationMs
    };

    if (res.statusCode >= 500) {
      Logger.error('Request failed', meta);
    } else if (res.statusCode >= 400) {
      Logger.warn('Request rejected', meta);
    } else {
      Logger.info('Request completed', meta);
    }
  });

  next();
};
