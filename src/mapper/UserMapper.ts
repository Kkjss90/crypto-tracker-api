import {UserEntity} from "../entity/UserEntity";
import {User} from "../model/User";
import {UserResponse} from "../dto/response/UserResponse";

export function toUser(entity: UserEntity): User {
  return {id: entity.id, username: entity.username, createdAt: new Date(entity.created_at)};
}

export function toUserResponse(user: User): UserResponse {
  return {id: user.id, username: user.username, createdAt: user.createdAt.toISOString()};
}
