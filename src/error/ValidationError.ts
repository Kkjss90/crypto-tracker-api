import {AppError} from "./AppError";
import {HttpStatusCode} from "axios";

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(HttpStatusCode.BadRequest, 'VALIDATION_ERROR', message, details);
  }
}
