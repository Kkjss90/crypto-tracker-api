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
import {createTimeFormatter} from "./utils/Time";
import {CurrenciesController} from "./controller/CurrenciesController";
import {CurrenciesRepository} from "./repository/CurrenciesRepository";
import {CurrenciesService} from "./service/CurrenciesService";

export interface AppDependencies {
  db: Db;
  provider: PriceProvider;
  apiKeyTtlDays: number;
  timeZone: string;
}

export function createApp({db, provider, apiKeyTtlDays, timeZone}: AppDependencies): Express {
  const formatTime = createTimeFormatter(timeZone);
  const coinsRepository = new CoinRepository(db);
  const coinsService = new CoinService(coinsRepository, provider);
  const coinsController = new CoinController(coinsService, formatTime);
  const pricesService = new PriceService(coinsRepository, new PriceRepository(db), provider);
  const pricesController = new PriceController(pricesService, formatTime);
  const authService = createAuthService(db, apiKeyTtlDays);
  const auth = createAuthMiddleware(authService);
  const authController = new AuthController(authService, formatTime);
  const currenciesService = new CurrenciesService(new CurrenciesRepository(db));
  const currenciesController = new CurrenciesController(currenciesService, formatTime);

  const app = express();

  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(express.json({limit: '100kb'}));

  app.get('/health', (_req, res) => {
    res.json({status: HttpStatusCode.Ok, code: 'OK'});
  });

  app.use(createDocsRouter());
  app.use(createRouter({coins: coinsController, prices: pricesController, authController, auth, currencies: currenciesController}));

  app.use(NotFound);
  app.use(ErrorHandler);

  return app;
}
