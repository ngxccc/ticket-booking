import { Test, type TestingModule } from "@nestjs/testing";
import { MailProcessor } from "./mail.processor";
import { MailService } from "@/modules/mail/mail.service";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Job } from "bullmq";

describe("MailProcessor", () => {
  let processor: MailProcessor;
  const mockMailService = {
    sendVerificationEmail: mock(() => Promise.resolve()),
    clearAll() {
      this.sendVerificationEmail.mockClear();
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

  it("should delegate email sending to MailService", async () => {
    const job = {
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
});
