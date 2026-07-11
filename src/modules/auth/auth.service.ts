import { ConflictException, Inject, Injectable } from "@nestjs/common";
import {
  DATABASE_CONNECTION,
  type DrizzleDB,
} from "@/database/database.module";
import { LoginDto, RefreshTokenDto, RegisterDto } from "./dto";
import { users } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/common/utils/crypto.util";
import { randomBytes } from "node:crypto";
import { I18nContext, I18nService } from "nestjs-i18n";
import type { I18nTranslations } from "@/generated/i18n.generated";
import { apiSuccess, type ApiResponse } from "@/common/utils/api-response.util";

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDB,
    private readonly i18n: I18nService<I18nTranslations>,
  ) {}

  async register(dto: RegisterDto): Promise<ApiResponse<null>> {
    const [existingUser] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (existingUser) {
      throw new ConflictException(
        this.i18n.t("auth.EMAIL_ALREADY_EXISTS", {
          lang: I18nContext.current()?.lang,
        }),
      );
    }

    const passwordHash = await hashPassword(dto.password);

    const verificationToken = randomBytes(32).toString("hex");
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // WHY: Combine user creation and verification token generation into a single INSERT statement to avoid redundant DB round-trips.
    await this.db.insert(users).values({
      email: dto.email,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      passwordHash,
      verificationToken,
      verificationExpiresAt,
    });

    return apiSuccess(null);
  }

  async login(dto: LoginDto) {
    void this.db;
    await Promise.resolve();
    return apiSuccess({
      email: dto.email,
    });
  }

  async refreshToken(dto: RefreshTokenDto) {
    void this.db;
    await Promise.resolve();
    return apiSuccess({
      token: dto.refreshToken,
    });
  }
}
