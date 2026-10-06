import { Router } from 'express';
import {CoinsController} from "../controller/CoinController";
import {createCoinsRouter} from "./Coin.routes";

export interface RouterDependencies {
  coins: CoinsController;
}

export function createRouter({ coins }: RouterDependencies): Router {
  const router = Router();
  router.use('/coins', createCoinsRouter(coins));
  return router;
}
