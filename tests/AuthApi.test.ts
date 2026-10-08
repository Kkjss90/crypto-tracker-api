import request from 'supertest';
import {createHttpClient, createTestApp, TEST_API_KEY, TEST_TTL_DAYS, TestApp} from "./utils/TestApp";
import {Logger} from "../src/utils/Logger";
import {createAuthService} from "../src/service/AuthService";

describe('registration and API keys', () => {
  let ctx: TestApp;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    ctx.cleanup();
  });

  const register = (username: string) => request(ctx.app).post('/auth/register').send({username});

  async function registerAs(username: string) {
    const res = await register(username);
    return {key: res.body.apiKey.key as string, keyId: res.body.apiKey.id as number};
  }

  describe('POST /auth/register', () => {
    it('создаёт пользователя и отдаёт ключ один раз', async () => {
      const res = await register('alice');

      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({username: 'alice'});
      expect(res.body.apiKey.key).toMatch(/^ctk_[0-9a-f]{64}$/);
      expect(res.body.apiKey.prefix).toBe(res.body.apiKey.key.slice(0, 12));
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('выданный ключ работает как Bearer-токен', async () => {
      const {key} = await registerAs('alice');

      const res = await createHttpClient(ctx.app, key).get('/coins');

      expect(res.status).toBe(200);
    });

    it('хранит в БД только хэш ключа', async () => {
      const {key} = await registerAs('alice');

      const rows = ctx.db.prepare('SELECT key_hash FROM api_keys').all();

      expect(rows.map((r) => r.key_hash)).not.toContain(key);
      expect(rows.every((r) => /^[0-9a-f]{64}$/.test(String(r.key_hash)))).toBe(true);
    });

    it('приводит имя к нижнему регистру', async () => {
      const res = await register('  Alice_01 ');

      expect(res.status).toBe(201);
      expect(res.body.user.username).toBe('alice_01');
    });

    it('409 на занятое имя (в любом регистре)', async () => {
      await register('alice');
      const res = await register('ALICE');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('409 на зарезервированное служебное имя', async () => {
      const res = await register('system');

      expect(res.status).toBe(409);
    });

    it.each(['ab', 'a b', 'имя_пользователя', 'x'.repeat(33), '', 'a-b'])(
      '400 на некорректное имя "%s"',
      async (username) => {
        const res = await register(username);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      },
    );

    it('400 без тела и на неизвестное поле', async () => {
      const noBody = await request(ctx.app).post('/auth/register');
      const extra = await request(ctx.app).post('/auth/register').send({username: 'alice', role: 'admin'});

      expect(noBody.status).toBe(400);
      expect(extra.status).toBe(400);
    });

    it('не пишет выданный ключ в логи', async () => {
      const spies = (['debug', 'info', 'warn', 'error'] as const).map((level) =>
        jest.spyOn(Logger, level).mockImplementation(() => {
        }),
      );

      const {key} = await registerAs('alice');

      expect(JSON.stringify(spies.map((s) => s.mock.calls))).not.toContain(key);
    });
  });

  describe('GET /auth/keys', () => {
    it('401 без ключа', async () => {
      const res = await request(ctx.app).get('/auth/keys');

      expect(res.status).toBe(401);
    });

    it('возвращает свои ключи без самого ключа и хэша', async () => {
      const {key} = await registerAs('alice');

      const res = await createHttpClient(ctx.app, key).get('/auth/keys');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({name: 'default'});
      expect(res.body[0]).not.toHaveProperty('key');
      expect(res.body[0]).not.toHaveProperty('keyHash');
      expect(JSON.stringify(res.body)).not.toContain(key);
    });

    it('не показывает чужие ключи', async () => {
      const alice = await registerAs('alice');
      await registerAs('bob');

      const res = await createHttpClient(ctx.app, alice.key).get('/auth/keys');

      expect(res.body).toHaveLength(1);
    });
  });

  describe('POST /auth/keys', () => {
    it('401 без ключа', async () => {
      const res = await request(ctx.app).post('/auth/keys');

      expect(res.status).toBe(401);
    });

    it('выпускает новый рабочий ключ с именем по умолчанию', async () => {
      const {key} = await registerAs('alice');
      const http = createHttpClient(ctx.app, key);

      const created = await http.post('/auth/keys');
      const used = await createHttpClient(ctx.app, created.body.key).get('/coins');

      expect(created.status).toBe(201);
      expect(created.body.name).toBe('api-key');
      expect(created.body.key).not.toBe(key);
      expect(created.headers['cache-control']).toBe('no-store');
      expect(used.status).toBe(200);
    });

    it('принимает имя ключа', async () => {
      const {key} = await registerAs('alice');

      const res = await createHttpClient(ctx.app, key).post('/auth/keys').send({name: 'ci'});

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('ci');
    });

    it.each([{name: ''}, {name: 'x'.repeat(51)}, {name: 5}, {other: 1}])(
      '400 на некорректное тело %j',
      async (body) => {
        const {key} = await registerAs('alice');

        const res = await createHttpClient(ctx.app, key).post('/auth/keys').send(body);

        expect(res.status).toBe(400);
      },
    );
  });

  describe('DELETE /auth/keys/:id', () => {
    it('401 без ключа', async () => {
      const res = await request(ctx.app).delete('/auth/keys/1');

      expect(res.status).toBe(401);
    });

    it('отзывает ключ: после этого он перестаёт работать', async () => {
      const first = await registerAs('alice');
      const http = createHttpClient(ctx.app, first.key);
      const second = await http.post('/auth/keys');

      const del = await http.delete(`/auth/keys/${second.body.id}`);
      const reuse = await createHttpClient(ctx.app, second.body.key).get('/coins');

      expect(del.status).toBe(204);
      expect(reuse.status).toBe(401);
    });

    it('409 при попытке отозвать последний ключ', async () => {
      const {key, keyId} = await registerAs('alice');

      const res = await createHttpClient(ctx.app, key).delete(`/auth/keys/${keyId}`);

      expect(res.status).toBe(409);
    });

    it('404 для чужого ключа, и тот продолжает работать', async () => {
      const alice = await registerAs('alice');
      const bob = await registerAs('bob');

      const res = await createHttpClient(ctx.app, alice.key).delete(`/auth/keys/${bob.keyId}`);
      const stillWorks = await createHttpClient(ctx.app, bob.key).get('/coins');

      expect(res.status).toBe(404);
      expect(stillWorks.status).toBe(200);
    });

    it('404 для несуществующего ключа', async () => {
      const {key} = await registerAs('alice');

      const res = await createHttpClient(ctx.app, key).delete('/auth/keys/9999');

      expect(res.status).toBe(404);
    });

    it('400 для некорректного id', async () => {
      const {key} = await registerAs('alice');

      const res = await createHttpClient(ctx.app, key).delete('/auth/keys/abc');

      expect(res.status).toBe(400);
    });
  });

  describe('токен из env', () => {
    it('работает наравне с пользовательскими ключами и принадлежит system', async () => {
      const res = await ctx.http.get('/auth/keys');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({name: 'bootstrap', prefix: 'env'});
    });

    it('смена ключа в env аннулирует старый', async () => {
      createAuthService(ctx.db, TEST_TTL_DAYS).ensureBootstrapKey('rotated-env-key-0123456789');

      const oldKey = await createHttpClient(ctx.app, TEST_API_KEY).get('/coins');
      const newKey = await createHttpClient(ctx.app, 'rotated-env-key-0123456789').get('/coins');

      expect(oldKey.status).toBe(401);
      expect(newKey.status).toBe(200);
    });
  });

  describe('срок действия ключей (TTL)', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    const expireKey = (keyId: number) =>
      ctx.db
        .prepare('UPDATE api_keys SET expires_at = ? WHERE id = ?')
        .run(new Date(Date.now() - 1000).toISOString(), keyId);

    const daysUntil = (iso: string) => (new Date(iso).getTime() - Date.now()) / DAY_MS;

    it('ключ после регистрации получает срок по умолчанию', async () => {
      const res = await register('alice');

      expect(daysUntil(res.body.apiKey.expiresAt)).toBeCloseTo(TEST_TTL_DAYS, 1);
      expect(res.body.apiKey.expired).toBe(false);
    });

    it('POST /auth/keys принимает свой срок', async () => {
      const {key} = await registerAs('alice');

      const res = await createHttpClient(ctx.app, key).post('/auth/keys').send({expiresInDays: 7});

      expect(res.status).toBe(201);
      expect(daysUntil(res.body.expiresAt)).toBeCloseTo(7, 1);
    });

    it.each([0, -1, 366, 1.5, '7', null])('400 на некорректный expiresInDays %j', async (value) => {
      const {key} = await registerAs('alice');

      const res = await createHttpClient(ctx.app, key).post('/auth/keys').send({expiresInDays: value});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('просроченный ключ даёт 401 с общим сообщением', async () => {
      const {key, keyId} = await registerAs('alice');
      expireKey(keyId);

      const res = await createHttpClient(ctx.app, key).get('/coins');

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid or missing API key');
    });

    it('причина отказа expired key попадает в лог, сам ключ нет', async () => {
      const {key, keyId} = await registerAs('alice');
      expireKey(keyId);
      const warn = jest.spyOn(Logger, 'warn').mockImplementation(() => {
      });

      await createHttpClient(ctx.app, key).get('/coins');

      expect(warn).toHaveBeenCalledWith(
        'Authentication failed',
        expect.objectContaining({reason: 'expired key'}),
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain(key);
    });

    it('просроченный ключ нельзя использовать для выпуска нового', async () => {
      const {key, keyId} = await registerAs('alice');
      expireKey(keyId);

      const res = await createHttpClient(ctx.app, key).post('/auth/keys');

      expect(res.status).toBe(401);
    });

    it('в списке просроченный ключ помечен expired', async () => {
      const first = await registerAs('alice');
      const http = createHttpClient(ctx.app, first.key);
      const second = await http.post('/auth/keys');
      expireKey(second.body.id);

      const res = await http.get('/auth/keys');
      const byId = (id: number) => res.body.find((k: { id: number }) => k.id === id);

      expect(byId(first.keyId).expired).toBe(false);
      expect(byId(second.body.id).expired).toBe(true);
    });

    it('нельзя отозвать последний действующий ключ, даже если есть просроченные', async () => {
      const first = await registerAs('alice');
      const http = createHttpClient(ctx.app, first.key);
      const second = await http.post('/auth/keys');
      expireKey(second.body.id);

      const res = await http.delete(`/auth/keys/${first.keyId}`);

      expect(res.status).toBe(409);
    });

    it('просроченный ключ можно отозвать', async () => {
      const first = await registerAs('alice');
      const http = createHttpClient(ctx.app, first.key);
      const second = await http.post('/auth/keys');
      expireKey(second.body.id);

      const res = await http.delete(`/auth/keys/${second.body.id}`);

      expect(res.status).toBe(204);
    });

    it('токен из env не истекает', async () => {
      const res = await ctx.http.get('/auth/keys');

      expect(res.body[0]).toMatchObject({name: 'bootstrap', expiresAt: null, expired: false});
    });
  });
});
