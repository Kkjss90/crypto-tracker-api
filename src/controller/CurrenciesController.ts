import type {Request, Response} from 'express';
import {CurrenciesService} from "../service/CurrenciesService";
import {TimeFormatter} from "../utils/Time";
import {validateCurrencyQuery} from "../utils/validator/CurrenciesValidator";
import {toCurrencyListResponse} from "../mapper/CurrencyMapper";

export class CurrenciesController {
  constructor(
    private readonly service: CurrenciesService,
    private readonly formatTime: TimeFormatter,
  ) {
  }

  list = (req: Request, res: Response): void => {
    const page = this.service.list(validateCurrencyQuery(req.query));
    res.json(toCurrencyListResponse(page, this.formatTime));
  };
}
