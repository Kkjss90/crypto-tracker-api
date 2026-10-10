import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import openapi from './openapi.json';

export function createDocsRouter(): Router {
  const router = Router();

  router.get('/openapi.json', (_req, res) => {
    res.json(openapi);
  });

  router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Crypto Tracker API' }));

  return router;
}
