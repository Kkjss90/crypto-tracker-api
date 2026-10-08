import {Router} from 'express';
import {PriceController} from "../controller/PriceController";

export function createPricesRouter(controller: PriceController): Router {
  const router = Router();

  router.get('/:id/price', controller.getPrice);
  router.get('/:id/history', controller.getHistory);

  return router;
}
