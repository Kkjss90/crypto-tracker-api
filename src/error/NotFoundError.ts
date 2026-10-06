import {AppError} from "./AppError";
import {HttpStatusCode} from "axios";

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(HttpStatusCode.NotFound, 'NOT_FOUND', message);
  }
}
