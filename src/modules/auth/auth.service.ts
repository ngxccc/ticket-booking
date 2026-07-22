import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  DATABASE_CONNECTION,
  type DrizzleDB,
} from "@/database/database.module";
import {
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from "./dto";
import { refreshTokens, users, outboxEvents } from "@/database/schemas";
import { OUTBOX_EVENT_TYPE } from "@/common/constants/event.constant";
import { PG_ERROR_CODE } from "@/common/constants/error.constant";
import { isPostgresErrorCode } from "@/common/utils/error.util";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  comparePassword,
  sha256,
} from "@/common/utils/crypto.util";
import { randomBytes } from "node:crypto";
import { getExpiryDate } from "@/common/utils/date.util";
import { I18nContext, I18nService } from "nestjs-i18n";
import type { I18nTranslations, I18nPath } from "@/generated/i18n.generated";
import { apiSuccess, type ApiResponse } from "@/common/utils/api-response.util";
import { JwtService } from "@nestjs/jwt";
import { env } from "@/env";

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDB,
    private readonly i18n: I18nService<I18nTranslations>,
    private readonly jwtService: JwtService,
  ) {}

  private throwException(
    key: I18nPath,
    Exception: new (message: string) => Error = BadRequestException,
  ): never {
    throw new Exception(
      this.i18n.t(key, {
        lang: I18nContext.current()?.lang,
      }),
    );
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = randomBytes(32).toString("hex");
    return { accessToken, refreshToken };
  }

  private async createTokenSession(
    userId: string,
    email: string,
    role: string,
  ) {
    const { accessToken, refreshToken } = await this.generateTokens(
      userId,
      email,
      role,
    );
    const tokenHash = sha256(refreshToken);
    const expiresAt = getExpiryDate(env.JWT_REFRESH_EXPIRES_IN || "7d");
    await this.db
      .insert(refreshTokens)
      .values({ userId, tokenHash, expiresAt });
    return { accessToken, refreshToken };
  }

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
    const verificationExpiresAt = getExpiryDate("24h");
    const status = env.NODE_ENV === "test" ? "active" : "pending_verification";

    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(users).values({
          email: dto.email,
          fullName: dto.fullName,
          phoneNumber: dto.phoneNumber,
          passwordHash,
          verificationToken,
          verificationExpiresAt,
          status,
        });

        // WHY: Store email verification event in the outbox_events table as part of the transaction for atomic consistency.
        await tx.insert(outboxEvents).values({
          eventType: OUTBOX_EVENT_TYPE.AUTH_VERIFICATION_EMAIL_REQUESTED,
          payload: {
            email: dto.email,
            fullName: dto.fullName,
            token: verificationToken,
          },
        });
      });
    } catch (error) {
      if (isPostgresErrorCode(error, PG_ERROR_CODE.UNIQUE_VIOLATION)) {
        throw new ConflictException(
          this.i18n.t("auth.EMAIL_ALREADY_EXISTS", {
            lang: I18nContext.current()?.lang,
          }),
        );
      }
      throw error;
    }
    return apiSuccess(null);
  }

  async verifyEmail(token: string): Promise<ApiResponse<null>> {
    const [user] = await this.db
      .select({
        id: users.id,
        verificationExpiresAt: users.verificationExpiresAt,
      })
      .from(users)
      .where(eq(users.verificationToken, token))
      .limit(1);

    if (!user) {
      this.throwException("auth.VERIFICATION_TOKEN_INVALID");
    }

    if (user.verificationExpiresAt && user.verificationExpiresAt < new Date()) {
      this.throwException("auth.VERIFICATION_TOKEN_EXPIRED");
    }

    await this.db
      .update(users)
      .set({
        status: "active",
        verificationToken: null,
        verificationExpiresAt: null,
      })
      .where(eq(users.id, user.id));

    return apiSuccess(null);
  }

  async login(dto: LoginDto) {
    const [user] = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        status: users.status,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (
      !user?.passwordHash ||
      user.status === "inactive" ||
      user.status === "suspended"
    ) {
      this.throwException("auth.INVALID_CREDENTIALS");
    }

    if (user.status === "pending_verification") {
      this.throwException("auth.EMAIL_NOT_VERIFIED");
    }

    const isPasswordValid = await comparePassword(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      this.throwException("auth.INVALID_CREDENTIALS");
    }

    const { accessToken, refreshToken } = await this.createTokenSession(
      user.id,
      user.email,
      user.role,
    );

    return apiSuccess({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  }

  async refreshToken(dto: RefreshTokenDto) {
    const hashedIncoming = sha256(dto.refreshToken);

    const [deletedToken] = await this.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashedIncoming))
      .returning({
        id: refreshTokens.id,
        userId: refreshTokens.userId,
        isRevoked: refreshTokens.isRevoked,
        expiresAt: refreshTokens.expiresAt,
      });

    if (
      !deletedToken ||
      deletedToken.isRevoked ||
      deletedToken.expiresAt < new Date()
    ) {
      this.throwException(
        "auth.TOKEN_INVALID_OR_EXPIRED",
        UnauthorizedException,
      );
    }

    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, deletedToken.userId))
      .limit(1);

    if (user?.status !== "active") {
      this.throwException(
        "auth.TOKEN_INVALID_OR_EXPIRED",
        UnauthorizedException,
      );
    }

    const { accessToken, refreshToken } = await this.createTokenSession(
      user.id,
      user.email,
      user.role,
    );

    return apiSuccess({ accessToken, refreshToken });
  }

  async logout(dto: RefreshTokenDto): Promise<ApiResponse<null>> {
    const hashedIncoming = sha256(dto.refreshToken);

    const [deletedToken] = await this.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashedIncoming))
      .returning({
        id: refreshTokens.id,
        isRevoked: refreshTokens.isRevoked,
        expiresAt: refreshTokens.expiresAt,
      });

    if (
      !deletedToken ||
      deletedToken.isRevoked ||
      deletedToken.expiresAt < new Date()
    ) {
      this.throwException(
        "auth.TOKEN_INVALID_OR_EXPIRED",
        UnauthorizedException,
      );
    }

    return apiSuccess(null);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<ApiResponse<null>> {
    const [user] = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        status: users.status,
      })
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    // WHY: Prevention of User Enumeration attacks. Return success generic message without exposing if email exists.
    if (user?.status !== "active") {
      return apiSuccess(null);
    }

    const resetToken = randomBytes(32).toString("hex");
    const resetPasswordExpiresAt = getExpiryDate("15m");

    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          resetPasswordToken: resetToken,
          resetPasswordExpiresAt,
        })
        .where(eq(users.id, user.id));

      // WHY: Save email sending request event in outbox_events to decouple DB update and BullMQ publish.
      await tx.insert(outboxEvents).values({
        eventType: OUTBOX_EVENT_TYPE.AUTH_RESET_PASSWORD_EMAIL_REQUESTED,
        payload: {
          email: dto.email,
          fullName: user.fullName,
          token: resetToken,
        },
      });
    });

    return apiSuccess(null);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<ApiResponse<null>> {
    const [user] = await this.db
      .select({
        id: users.id,
        resetPasswordExpiresAt: users.resetPasswordExpiresAt,
      })
      .from(users)
      .where(eq(users.resetPasswordToken, dto.token))
      .limit(1);

    if (
      !user?.resetPasswordExpiresAt ||
      user.resetPasswordExpiresAt < new Date()
    ) {
      this.throwException("auth.RESET_PASSWORD_TOKEN_INVALID");
    }

    const passwordHash = await hashPassword(dto.password);

    await this.db.transaction(async (tx) => {
      // WHY: Update password hash and clean reset token fields to prevent token reuse.
      await tx
        .update(users)
        .set({
          passwordHash,
          resetPasswordToken: null,
          resetPasswordExpiresAt: null,
        })
        .where(eq(users.id, user.id));

      // WHY: Session invalidation (force-logout from all devices). Delete all active refresh tokens.
      await tx.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));
    });

    return apiSuccess(null);
  }
}
