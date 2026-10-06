import express from 'express';
import type { Express } from 'express';
import { ErrorHandler } from './middleware/ErrorHandler';
import { NotFound } from './middleware/NotFound';
import {HttpStatusCode} from "axios";

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: HttpStatusCode.Ok });
  });

  app.use(NotFound);
  app.use(ErrorHandler);

  return app;
}
