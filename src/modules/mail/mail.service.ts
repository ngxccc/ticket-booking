import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";
import { AUTH_ROUTES } from "@/modules/auth/auth.routes";
import { env } from "@/env";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;

  constructor() {
    // WHY: Initialize Resend client inside constructor using type-safe environment key.
    this.resend = new Resend(env.RESEND_API_KEY);
  }

  async sendVerificationEmail(
    email: string,
    fullName: string,
    token: string,
  ): Promise<void> {
    const verificationUrl = `${env.DOMAIN_NAME}/${AUTH_ROUTES.BASE}/${AUTH_ROUTES.VERIFY_EMAIL}?token=${token}`;

    try {
      const { data, error } = await this.resend.emails.send({
        from: env.EMAIL_FROM,
        to: email,
        subject: "Xác thực tài khoản của bạn",
        html: `
          <p>Xin chào <strong>${fullName}</strong>,</p>
          <p>Cảm ơn bạn đã đăng ký tài khoản tại Ticket Booking. Vui lòng click vào đường link dưới đây để kích hoạt tài khoản:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
          <br/>
          <p>Đường link có thời hạn là 24h.</p>
        `,
      });

      if (error) {
        this.logger.error(`Resend API Error: ${error.message}`);
        throw new Error(error.message);
      }

      this.logger.log(`Email sent successfully to ${email}. ID: ${data.id}`);
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${email}`, err);
      throw err;
    }
  }
}
