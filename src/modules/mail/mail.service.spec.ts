import { Test, type TestingModule } from "@nestjs/testing";
import { MailService } from "./mail.service";
import { beforeEach, describe, expect, it, mock } from "bun:test";

// WHY: Mock the resend module globally using Bun's native mock.module wrapper.
const mockSend = mock(() =>
  Promise.resolve<{
    data: { id: string } | null;
    error: { name: string; message: string } | null;
  }>({
    data: { id: "mock-email-id-123" },
    error: null,
  }),
);

await mock.module("resend", () => {
  return {
    Resend: class {
      emails = {
        send: mockSend,
      };
    },
  };
});

describe("MailService", () => {
  let service: MailService;

  beforeEach(async () => {
    mockSend.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should successfully call resend.emails.send", async () => {
    await service.sendVerificationEmail(
      "test@testmail.io",
      "Test User",
      "token-xyz",
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@testmail.io",
        subject: "Xác thực tài khoản của bạn",
        html: expect.stringContaining("token-xyz") as unknown as string,
      }),
    );
  });

  it("should throw error if resend returned an API error", async () => {
    mockSend.mockImplementationOnce(() =>
      Promise.resolve({
        data: null,
        error: { name: "Error", message: "API Error" },
      }),
    );

    let thrown = false;
    try {
      await service.sendVerificationEmail(
        "test@testmail.io",
        "Test User",
        "token-xyz",
      );
    } catch (err) {
      thrown = true;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("API Error");
    }
    expect(thrown).toBe(true);
  });
});
