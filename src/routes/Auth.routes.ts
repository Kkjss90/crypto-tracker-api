import {Router} from 'express';
import type {RequestHandler} from 'express';
import type {AuthController} from '../controller/AuthController';

export function createAuthRouter(controller: AuthController, auth: RequestHandler): Router {
  const router = Router();

  router.post('/register', controller.register);
  router.get('/keys', auth, controller.listKeys);
  router.post('/keys', auth, controller.createKey);
  router.delete('/keys/:id', auth, controller.revokeKey);

  return router;
}
