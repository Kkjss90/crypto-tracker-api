import {UserEntity} from "../entity/UserEntity";
import {User} from "../model/User";
import {UserResponse} from "../dto/response/UserResponse";
import {TimeFormatter} from "../utils/Time";

export function toUser(entity: UserEntity): User {
  return {id: entity.id, username: entity.username, createdAt: new Date(entity.created_at)};
}

export function toUserResponse(user: User, formatTime: TimeFormatter): UserResponse {
  return { id: user.id, username: user.username, createdAt: formatTime(user.createdAt) };
}
