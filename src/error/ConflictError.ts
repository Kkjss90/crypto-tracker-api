import { HttpStatusCode } from 'axios';
import { AppError } from './AppError';

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(HttpStatusCode.Conflict, 'CONFLICT', message);
  }
}
