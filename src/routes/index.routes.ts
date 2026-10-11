import {RequestHandler, Router} from 'express';
import {CoinController} from "../controller/CoinController";
import {createCoinsRouter} from "./Coin.routes";
import {createAuthRouter} from "./Auth.routes";
import {AuthController} from "../controller/AuthController";
import {createPricesRouter} from "./Price.routes";
import {PriceController} from "../controller/PriceController";
import {createCurrenciesRouter} from "./Currencies.routes";
import {CurrenciesController} from "../controller/CurrenciesController";

export interface RouterDependencies {
  coins: CoinController;
  prices: PriceController;
  authController: AuthController;
  auth: RequestHandler;
  currencies: CurrenciesController;
}

export function createRouter({coins, prices, authController, auth, currencies}: RouterDependencies): Router {
  const router = Router();
  router.use('/auth', createAuthRouter(authController, auth));
  router.use('/coins', auth, createCoinsRouter(coins), createPricesRouter(prices));
  router.use('/currencies', auth, createCurrenciesRouter(currencies));
  return router;
}
