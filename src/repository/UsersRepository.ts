import {Db} from "../database/Connection";
import {User} from "../model/User";
import {toUser} from "../mapper/UserMapper";
import {UserEntity} from "../entity/UserEntity";

export class UsersRepository {
  constructor(private readonly db: Db) {
  }

  create(username: string): User {
    const createdAt = new Date();
    const result = this.db
      .prepare('INSERT INTO users (username, created_at) VALUES (?, ?)')
      .run(username, createdAt.toISOString());

    return {id: Number(result.lastInsertRowid), username, createdAt};
  }

  findByUsername(username: string): User | undefined {
    const row = this.db
      .prepare('SELECT id, username, created_at FROM users WHERE username = ?')
      .get(username);

    return row ? toUser(row as unknown as UserEntity) : undefined;
  }
}
