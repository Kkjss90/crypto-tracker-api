export class DataBaseError extends Error {
  constructor(message = 'Something went wrong with the database', error?: Error) {
    super(message, error);
  }
}
