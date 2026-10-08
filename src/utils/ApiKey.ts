import {randomBytes} from 'node:crypto';

const API_KEY_PREFIX = 'ctk_';
const VISIBLE_PREFIX_LENGTH = API_KEY_PREFIX.length + 8;

export function generateApiKey(): string {
  return API_KEY_PREFIX + randomBytes(32).toString('hex');
}

export function keyPrefix(key: string): string {
  return key.slice(0, VISIBLE_PREFIX_LENGTH);
}
