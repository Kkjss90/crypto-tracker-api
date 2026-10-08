import type {Request, Response} from 'express';
import {AuthService} from "../service/AuthService";
import {validateCreateApiKey, validateRegister} from "../utils/validator/AuthValidator";
import {toUserResponse} from "../mapper/UserMapper";
import {toApiKeyResponse, toCreatedApiKeyResponse} from "../mapper/ApiKeyMapper";
import {parseId} from "../utils/validator/BasicValidation";
import {getPrincipal} from "../middleware/Auth";

export class AuthController {
  constructor(private readonly service: AuthService) {
  }

  register = (req: Request, res: Response): void => {
    const {username} = validateRegister(req.body);
    const {user, apiKey, rawKey} = this.service.register(username);

    res
      .status(201)
      .set('Cache-Control', 'no-store')
      .json({user: toUserResponse(user), apiKey: toCreatedApiKeyResponse(apiKey, rawKey)});
  };

  listKeys = (_req: Request, res: Response): void => {
    const {userId} = getPrincipal(res);
    res.json(this.service.listKeys(userId).map((key) => toApiKeyResponse(key)));
  };

  createKey = (req: Request, res: Response): void => {
    const {userId} = getPrincipal(res);
    const {name, expiresInDays} = validateCreateApiKey(req.body);
    const {apiKey, rawKey} = this.service.createKey(userId, name, expiresInDays);

    res.status(201).set('Cache-Control', 'no-store').json(toCreatedApiKeyResponse(apiKey, rawKey));
  };

  revokeKey = (req: Request, res: Response): void => {
    const {userId} = getPrincipal(res);
    this.service.revokeKey(userId, parseId(req.params.id));
    res.status(204).send();
  };
}
