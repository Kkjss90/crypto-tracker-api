export interface ApiKeyResponse {
  id: number;
  name: string;
  prefix: string;
  createdAt: string;
  expiresAt: string | null;
  expired: boolean;
}
