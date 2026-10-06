import express from 'express';
import type { Express } from 'express';
import {Db} from "./database/Connection";
import {PriceProvider} from "./client/provider/PriceProvider";
import {CoinsRepository} from "./repository/CoinsRepository";
import {CoinsService} from "./service/CoinService";
import {CoinsController} from "./controller/CoinController";
import {requestLogger} from "./middleware/RequestLogger";
import {createRouter} from "./routes/index.routes";
import {ErrorHandler} from "./middleware/ErrorHandler";
import {NotFound} from "./middleware/NotFound";
import {HttpStatusCode} from "axios";

export interface AppDependencies {
  db: Db;
  provider: PriceProvider;
}

export function createApp({ db, provider }: AppDependencies): Express {
  const coinsRepository = new CoinsRepository(db);
  const coinsService = new CoinsService(coinsRepository, provider);
  const coinsController = new CoinsController(coinsService);

  const app = express();

  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: HttpStatusCode.Ok, code: 'OK' });
  });

  app.use(createRouter({ coins: coinsController }));

  app.use(NotFound);
  app.use(ErrorHandler);

  return app;
}
