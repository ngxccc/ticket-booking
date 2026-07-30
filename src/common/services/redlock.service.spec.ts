/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";
import { RedlockService } from "./redlock.service";
import { ConfigService } from "@nestjs/config";

describe("RedlockService", () => {
  let redlockService: RedlockService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService({
      REDIS_URL: "redis://localhost:6379",
    });
    redlockService = new RedlockService(configService);
  });

  afterEach(async () => {
    await redlockService.onModuleDestroy();
  });

  it("should instantiate RedlockService correctly", () => {
    expect(redlockService).toBeDefined();
    expect(redlockService.getRedisClient()).toBeDefined();
  });

  it("should acquire lock successfully", async () => {
    const mockLock = { release: mock(async () => undefined) };
    const spyAcquire = mock(async () => mockLock);
    (redlockService as any).redlock = { acquire: spyAcquire };

    const lock = await redlockService.acquireLock(["lock:seat:1"], 2000);
    expect(lock).toBeDefined();
    expect(spyAcquire).toHaveBeenCalledWith(["lock:seat:1"], 2000);
  });

  it("should release lock gracefully and catch errors silently", async () => {
    const mockRelease = mock(async () => {
      throw new Error("Lock expired");
    });
    const mockLock = { release: mockRelease } as any;

    expect(redlockService.releaseLock(mockLock)).resolves.toBeUndefined();
    expect(mockRelease).toHaveBeenCalled();
  });

  it("should handle onModuleDestroy gracefully when client is disconnected or ready", async () => {
    const mockQuit = mock(async () => "OK");
    const mockDisconnect = mock(() => undefined);

    (redlockService as any).redisClient = {
      status: "ready",
      quit: mockQuit,
      disconnect: mockDisconnect,
    };

    await redlockService.onModuleDestroy();
    expect(mockQuit).toHaveBeenCalled();
  });
});
