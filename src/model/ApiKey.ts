export interface ApiKey {
  id: number;
  userId: number;
  name: string;
  prefix: string;
  createdAt: Date;
  expiresAt: Date | null;
}
