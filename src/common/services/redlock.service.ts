import { Injectable } from "@nestjs/common";
import type { OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import Redlock, { type Lock } from "redlock";
import { parseRedisOptions } from "../../config/redis.config";

@Injectable()
export class RedlockService implements OnModuleInit, OnModuleDestroy {
  private readonly redisClient: Redis;
  private readonly redlock: Redlock;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>("REDIS_URL");
    const options = parseRedisOptions(redisUrl);

    this.redisClient = new Redis(options);
    // WHY: ioredis is an EventEmitter that emits "error" events on dual IPv4/IPv6 socket lookup failures or reconnects. Registering an error listener prevents Node/Bun from logging "Unhandled error event" noise to stderr.
    this.redisClient.on("error", (_err: unknown) => {
      void 0;
    });

    this.redlock = new Redlock([this.redisClient], {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 50,
      automaticExtensionThreshold: 500,
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.redisClient.status === "ready") return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        resolve();
      }, 2000);
      const onReady = () => {
        clearTimeout(timer);
        resolve();
      };
      if (this.redisClient.status === "ready") {
        onReady();
      } else {
        this.redisClient.once("ready", onReady);
      }
    });
  }

  async acquireLock(resources: string[], ttl = 2000): Promise<Lock> {
    return await this.redlock.acquire(resources, ttl);
  }

  async releaseLock(lock: Lock): Promise<void> {
    try {
      await lock.release();
    } catch {
      // WHY: Lock may have expired or already been released, silent catch prevents crashing worker/request.
    }
  }

  getRedisClient(): Redis {
    return this.redisClient;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.redisClient.status === "ready") {
        await this.redisClient.quit();
      } else {
        this.redisClient.disconnect();
      }
    } catch {
      // WHY: Silent catch prevents teardown failures when Redis is offline or disconnected during tests.
    }
  }
}
