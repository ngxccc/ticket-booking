import { BullModule } from "@nestjs/bullmq";
import { ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { env } from "./env";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
} from "nestjs-i18n";
import path from "node:path";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./modules/auth/auth.module";

const getRedisOptions = () => {
  if (env.REDIS_URL) {
    const parsed = new URL(env.REDIS_URL);
    return {
      host: parsed.hostname,
      port: Number(parsed.port),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
      enableReadyCheck: false, // WHY: Upstash read-only credentials do not have permission to execute the INFO command.
      skipVersionCheck: true, // WHY: Prevent BullMQ from calling INFO command to check Redis version during connection init.
    };
  }
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  };
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      connection: getRedisOptions(),
    }),
    I18nModule.forRoot({
      fallbackLanguage: "vi",
      loaderOptions: {
        path: path.join(__dirname, "/i18n/"),
        watch: true,
      },
      resolvers: [new HeaderResolver(["x-lang"]), AcceptLanguageResolver],
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: "default",
          ttl: 60000,
          limit: 100,
        },
        {
          name: "auth",
          ttl: 60000,
          limit: env.NODE_ENV === "production" ? 5 : 100,
        },
      ],
      storage:
        env.NODE_ENV === "test"
          ? undefined
          : new ThrottlerStorageRedisService(getRedisOptions()),
    }),
    DatabaseModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
