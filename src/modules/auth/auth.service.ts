import { Inject, Injectable } from "@nestjs/common";
import {
  DATABASE_CONNECTION,
  type DrizzleDB,
} from "@/database/database.module";
import { LoginDto, RefreshTokenDto, RegisterDto } from "./dto";

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDB,
  ) {}

  async register(dto: RegisterDto) {
    void this.db;
    await Promise.resolve();
    return { message: "User registered successfully", data: dto };
  }

  async login(dto: LoginDto) {
    void this.db;
    await Promise.resolve();
    return { message: "User logged in successfully", email: dto.email };
  }

  async refreshToken(dto: RefreshTokenDto) {
    void this.db;
    await Promise.resolve();
    return { message: "Token refreshed successfully", token: dto.refreshToken };
  }
}
