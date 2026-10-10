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
import {createAuthService} from "./service/AuthService";
import {AuthController} from "./controller/AuthController";
import {PriceService} from "./service/PriceHistoryService";
import {PriceController} from "./controller/PriceController";
import {PriceRepository} from "./repository/PriceRepository";
import {createDocsRouter} from "./docs/Swagger";

export interface AppDependencies {
  db: Db;
  provider: PriceProvider;
  apiKeyTtlDays: number;
}

export function createApp({db, provider, apiKeyTtlDays}: AppDependencies): Express {
  const coinsRepository = new CoinRepository(db);
  const coinsService = new CoinService(coinsRepository, provider);
  const coinsController = new CoinController(coinsService);
  const pricesService = new PriceService(coinsRepository, new PriceRepository(db), provider);
  const pricesController = new PriceController(pricesService);
  const authService = createAuthService(db, apiKeyTtlDays);
  const auth = createAuthMiddleware(authService);
  const authController = new AuthController(authService);

  const app = express();

  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(express.json({limit: '100kb'}));

  app.get('/health', (_req, res) => {
    res.json({status: HttpStatusCode.Ok, code: 'OK'});
  });

  app.use(createDocsRouter());
  app.use(createRouter({coins: coinsController, prices: pricesController, authController, auth}));

  app.use(NotFound);
  app.use(ErrorHandler);

  return app;
}
