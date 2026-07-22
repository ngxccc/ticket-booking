import { Test, type TestingModule } from "@nestjs/testing";
import { MailProcessor } from "./mail.processor";
import { MailService } from "@/modules/mail/mail.service";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { MAIL_JOB_NAME } from "@/common/constants/event.constant";
import type { Job } from "bullmq";

describe("MailProcessor", () => {
  let processor: MailProcessor;
  const mockMailService = {
    sendVerificationEmail: mock(() => Promise.resolve()),
    sendPasswordResetEmail: mock(() => Promise.resolve()),
    clearAll() {
      this.sendVerificationEmail.mockClear();
      this.sendPasswordResetEmail.mockClear();
    },
  };

  beforeEach(async () => {
    mockMailService.clearAll();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailProcessor,
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    processor = module.get<MailProcessor>(MailProcessor);
  });

  it("should be defined", () => {
    expect(processor).toBeDefined();
  });

  it("should delegate verification email sending to MailService", async () => {
    const job = {
      name: MAIL_JOB_NAME.SEND_VERIFICATION,
      data: {
        email: "test@example.com",
        fullName: "Test User",
        token: "token-123",
      },
    } as unknown as Job<{ email: string; fullName: string; token: string }>;

    await processor.process(job);

    expect(mockMailService.sendVerificationEmail).toHaveBeenCalledWith(
      "test@example.com",
      "Test User",
      "token-123",
    );
  });

  it("should delegate password reset email sending to MailService", async () => {
    const job = {
      name: MAIL_JOB_NAME.SEND_RESET_PASSWORD,
      data: {
        email: "reset@example.com",
        fullName: "Reset User",
        token: "reset-token",
      },
    } as unknown as Job<{ email: string; fullName: string; token: string }>;

    await processor.process(job);

    expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      "reset@example.com",
      "Reset User",
      "reset-token",
    );
  });

  it("should throw error for unsupported job names", () => {
    const job = {
      name: "unsupported-job",
      data: {
        email: "test@example.com",
        fullName: "Test User",
        token: "token-123",
      },
    } as unknown as Job<{ email: string; fullName: string; token: string }>;

    expect(processor.process(job)).rejects.toThrow(
      "Unsupported mail job name: unsupported-job",
    );
  });
});
