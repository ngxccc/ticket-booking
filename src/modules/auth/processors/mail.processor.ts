import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { MailService } from "@/modules/mail/mail.service";

@Processor("mail")
export class MailProcessor extends WorkerHost {
  constructor(private readonly mailService: MailService) {
    super();
  }
  async process(
    job: Job<{ email: string; fullName: string; token: string }>,
  ): Promise<void> {
    const { email, fullName, token } = job.data;

    // WHY: Delegate actual email sending via Resend SDK to MailService.
    await this.mailService.sendVerificationEmail(email, fullName, token);
  }
}
