import { Global, Module, type OnModuleDestroy } from "@nestjs/common";
import type Redis from "ioredis";
import { createRedisClient } from "@/config/redis.config";
import { SentryService } from "../services/sentry.service";
import { SENTRY_BREADCRUMB_CATEGORY } from "@/common/constants/sentry.constant";
export const REDIS_CLIENT = "REDIS_CLIENT";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [{ token: SentryService, optional: true }],
      useFactory: (sentryService?: SentryService): Redis => {
        const client = createRedisClient();
        client.on("error", (err: unknown) => {
          sentryService?.addBreadcrumb({
            category: SENTRY_BREADCRUMB_CATEGORY.CACHE,
            message: `Redis client socket error: ${err instanceof Error ? err.message : String(err)}`,
            level: "warning",
          });
        });
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    // Teardown handled cleanly during application shutdown
  }
}
