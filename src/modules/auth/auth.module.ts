import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { MailModule } from "@/modules/mail/mail.module";
import { MailProcessor } from "./processors/mail.processor";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "mail",
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, MailProcessor],
})
export class AuthModule {}
