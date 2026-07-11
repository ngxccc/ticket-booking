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
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./modules/auth/auth.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
          limit: 5,
        },
      ],
      storage:
        env.NODE_ENV === "test"
          ? undefined
          : new ThrottlerStorageRedisService(
              env.REDIS_URL ??
                `redis://${env.REDIS_HOST}:${String(env.REDIS_PORT)}`,
            ),
    }),
    DatabaseModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
