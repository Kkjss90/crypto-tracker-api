import type {Request, Response} from 'express';
import type {PriceService} from "../service/PriceHistoryService";
import {parseId} from "../utils/validator/BasicValidation";
import {toHistoryResponse, toPriceResponse} from "../mapper/PriceMapper";
import {validateHistoryQuery} from "../utils/validator/PriceValidator";


export class PriceController {
  constructor(private readonly service: PriceService) {
  }

  getPrice = async (req: Request, res: Response): Promise<void> => {
    const coinId = parseId(req.params.id);
    const {coin, point} = await this.service.fetchCurrent(coinId);

    res.json(toPriceResponse(coin, point));
  };

  getHistory = (req: Request, res: Response): void => {
    const coinId = parseId(req.params.id);
    const query = validateHistoryQuery(req.query);
    const {coin, page} = this.service.history(coinId, query);

    res.json(toHistoryResponse(coin, page));
  };
}
