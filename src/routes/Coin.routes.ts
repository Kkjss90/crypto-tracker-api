import { Router } from 'express';
import {CoinsController} from "../controller/CoinController";

export function createCoinsRouter(controller: CoinsController): Router {
  const router = Router();

  router.post('/', controller.create);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}
