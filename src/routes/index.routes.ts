import {RequestHandler, Router} from 'express';
import {CoinController} from "../controller/CoinController";
import {createCoinsRouter} from "./Coin.routes";

export interface RouterDependencies {
  coins: CoinController;
  auth: RequestHandler;
}

export function createRouter({coins, auth}: RouterDependencies): Router {
  const router = Router();
  router.use('/coins', auth, createCoinsRouter(coins));
  return router;
}
