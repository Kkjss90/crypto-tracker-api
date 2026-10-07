import express from 'express';
import type {Express} from 'express';
import {Db} from "./database/Connection";
import {PriceProvider} from "./client/provider/PriceProvider";
import {CoinRepository} from "./repository/CoinRepository";
import {CoinService} from "./service/CoinService";
import {CoinController} from "./controller/CoinController";
import {requestLogger} from "./middleware/RequestLogger";
import {createRouter} from "./routes/index.routes";
import {ErrorHandler} from "./middleware/ErrorHandler";
import {NotFound} from "./middleware/NotFound";
import {HttpStatusCode} from "axios";
import {createAuthMiddleware} from "./middleware/Auth";
import {AuthService} from "./service/AuthService";
import {ApiKeyRepository} from "./repository/ApiKeyRepository";

export interface AppDependencies {
  db: Db;
  provider: PriceProvider;
}

export function createApp({db, provider}: AppDependencies): Express {
  const coinsRepository = new CoinRepository(db);
  const coinsService = new CoinService(coinsRepository, provider);
  const coinsController = new CoinController(coinsService);
  const authService = new AuthService(new ApiKeyRepository(db));
  const auth = createAuthMiddleware(authService);

  const app = express();

  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(express.json({limit: '100kb'}));

  app.get('/health', (_req, res) => {
    res.json({status: HttpStatusCode.Ok, code: 'OK'});
  });

  app.use(createRouter({coins: coinsController, auth}));

  app.use(NotFound);
  app.use(ErrorHandler);

  return app;
}
