export function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message.includes('UNIQUE constraint failed');
}
