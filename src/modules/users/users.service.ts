import { Inject, Injectable } from "@nestjs/common";
import {
  I18nForbiddenException,
  I18nNotFoundException,
} from "@/common/exceptions";
import { eq } from "drizzle-orm";
import {
  DATABASE_CONNECTION,
  type DrizzleDB,
} from "@/database/database.module";
import { users } from "@/database/schemas";
import type { UserResponseDto } from "./dto/user-response.dto";

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDB,
  ) {}

  async getProfile(userId: string): Promise<UserResponseDto> {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new I18nNotFoundException("users.USER_NOT_FOUND");
    }

    if (user.status === "suspended" || user.status === "inactive") {
      throw new I18nForbiddenException("users.ACCOUNT_SUSPENDED_OR_INACTIVE");
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isVerified: user.status !== "pending_verification",
      status: user.status,
    };
  }
}
