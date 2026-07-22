import { Test, type TestingModule } from "@nestjs/testing";
import { TokenCleanupService } from "./token-cleanup.service";
import { DATABASE_CONNECTION } from "@/database/database.module";
import { beforeEach, describe, expect, it } from "bun:test";
import { createMockDb } from "../../../test/mocks";

describe("TokenCleanupService", () => {
  let service: TokenCleanupService;
  const mockDb = createMockDb();

  beforeEach(async () => {
    mockDb.clearAll();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenCleanupService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<TokenCleanupService>(TokenCleanupService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should delete expired refresh tokens when cleanupTokens is called", async () => {
    await service.cleanupTokens();
    expect(mockDb.delete).toHaveBeenCalled();
  });
});
