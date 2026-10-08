export interface ApiKeyEntity {
  id: number;
  user_id: number;
  key_hash: string;
  key_prefix: string;
  name: string;
  created_at: string;
  expires_at: string | null;
}
