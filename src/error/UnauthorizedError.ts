import {AppError} from "./AppError";
import {HttpStatusCode} from "axios";

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(HttpStatusCode.Unauthorized, 'UNAUTHORIZED', message);
  }
}
