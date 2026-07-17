import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { JwtModule } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { MailModule } from "@/modules/mail/mail.module";
import { MailProcessor } from "./processors/mail.processor";
import { env } from "@/env";
import type { StringValue } from "ms";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "mail",
    }),
    MailModule,
    JwtModule.register({
      global: true,
      secret: env.JWT_SECRET,
      signOptions: {
        expiresIn: env.JWT_ACCESS_EXPIRES_IN as StringValue,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, MailProcessor],
})
export class AuthModule {}
