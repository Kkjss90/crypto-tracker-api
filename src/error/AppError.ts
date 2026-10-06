import {HttpStatusCode} from "axios";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }

  get isServerError(): boolean {
    return this.statusCode >= HttpStatusCode.InternalServerError;
  }
}
