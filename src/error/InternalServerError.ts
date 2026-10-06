import {AppError} from "./AppError";
import {HttpStatusCode} from "axios";

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(HttpStatusCode.InternalServerError, 'INTERNAL_ERROR', message);
  }
}
