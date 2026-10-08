import {RequestHandler, Router} from 'express';
import {CoinController} from "../controller/CoinController";
import {createCoinsRouter} from "./Coin.routes";
import {createAuthRouter} from "./Auth.routes";
import {AuthController} from "../controller/AuthController";
import {createPricesRouter} from "./Price.routes";
import {PriceController} from "../controller/PriceController";

export interface RouterDependencies {
  coins: CoinController;
  prices: PriceController;
  authController: AuthController;
  auth: RequestHandler;
}

export function createRouter({coins, prices, authController, auth}: RouterDependencies): Router {
  const router = Router();
  router.use('/auth', createAuthRouter(authController, auth));
  router.use('/coins', auth, createCoinsRouter(coins), createPricesRouter(prices));
  return router;
}
