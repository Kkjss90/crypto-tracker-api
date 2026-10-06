import {AppError} from "./AppError";
import {HttpStatusCode} from "axios";

export class ExternalApiError extends AppError {
  constructor(message = 'External service error', statusCode: typeof HttpStatusCode.BadGateway | typeof HttpStatusCode.GatewayTimeout = HttpStatusCode.BadGateway) {
    super(statusCode, 'EXTERNAL_API_ERROR', message);
  }
}
