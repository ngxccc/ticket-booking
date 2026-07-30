import { BullModule } from "@nestjs/bullmq";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
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
import { UsersModule } from "./modules/users/users.module";
import { OutboxModule } from "./modules/outbox/outbox.module";
import { BookingModule } from "./modules/booking/booking.module";
import { AppController } from "./app.controller";
import { parseRedisOptions } from "./config/redis.config";

const getRedisOptions = () =>
  parseRedisOptions(env.REDIS_URL, env.REDIS_HOST, env.REDIS_PORT);

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
    UsersModule,
    OutboxModule,
    BookingModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
