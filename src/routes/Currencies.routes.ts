import {Router} from 'express';
import type {CurrenciesController} from '../controller/CurrenciesController';

export function createCurrenciesRouter(controller: CurrenciesController): Router {
  const router = Router();
  router.get('/', controller.list);
  return router;
}
