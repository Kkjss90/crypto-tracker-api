import type {Request, Response} from 'express';
import {CoinService} from "../service/CoinService";
import {validateCreateCoin, validateUpdateCoin} from "../utils/validator/CoinValidator";
import {toCoinResponse} from "../mapper/CoinMapper";
import {parseId} from "../utils/validator/BasicValidation";
import {HttpStatusCode} from "axios";

export class CoinController {
  constructor(private readonly service: CoinService) {
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const request = validateCreateCoin(req.body);
    const coin = await this.service.add(request.symbol);

    res.status(HttpStatusCode.Created.valueOf()).location(`/coins/${coin.id}`).json(toCoinResponse(coin));
  };

  list = (_req: Request, res: Response): void => {
    res.json(this.service.list().map(toCoinResponse));
  };

  get = (req: Request, res: Response): void => {
    const coin = this.service.get(parseId(req.params.id));
    res.json(toCoinResponse(coin));
  };

  update = (req: Request, res: Response): void => {
    const id = parseId(req.params.id);
    const request = validateUpdateCoin(req.body);

    res.json(toCoinResponse(this.service.rename(id, request.name)));
  };

  remove = (req: Request, res: Response): void => {
    this.service.remove(parseId(req.params.id));
    res.status(HttpStatusCode.NoContent.valueOf()).send();
  };
}
