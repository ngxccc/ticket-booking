import { SentryService } from "@/common/services/sentry.service";
import { SENTRY_BREADCRUMB_CATEGORY } from "@/common/constants/sentry.constant";
import type { Logger as DrizzleLogger } from "drizzle-orm/logger";
import { Global, Module } from "@nestjs/common";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schemas";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import type {
  ExtractTablesFromSchema,
  ExtractTablesWithRelations,
} from "drizzle-orm";

export const DATABASE_CONNECTION = "DATABASE_CONNECTION";
export type DrizzleDB = NodePgDatabase<
  ExtractTablesWithRelations<
    Record<string, never>,
    ExtractTablesFromSchema<typeof schema>
  >
>;

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService, { token: SentryService, optional: true }],
      useFactory: (config: ConfigService, sentryService?: SentryService) => {
        let databaseUrl = config.get<string>("DB_URL");
        if (databaseUrl) {
          // Map legacy SSL modes to 'sslmode=verify-full' to suppress pg-connection-string warnings and ensure future-proof compatibility.
          databaseUrl = databaseUrl.replace(
            /sslmode=(require|prefer|verify-ca)/gi,
            "sslmode=verify-full",
          );
        }
        const pool = databaseUrl
          ? new Pool({ connectionString: databaseUrl })
          : new Pool({
              host: config.get<string>("DB_HOST") ?? "localhost",
              port: Number(config.get<string | number>("DB_PORT")) || 5432,
              user: config.get<string>("DB_USERNAME") ?? "postgres",
              password: config.get<string>("DB_PASSWORD") ?? "postgrespassword",
              database: config.get<string>("DB_DATABASE") ?? "ticket_booking",
            });

        const drizzleLogger: DrizzleLogger = {
          logQuery(query: string, params: unknown[]): void {
            sentryService?.addBreadcrumb({
              category: SENTRY_BREADCRUMB_CATEGORY.DB_QUERY,
              message: query.length > 300 ? `${query.slice(0, 300)}...` : query,
              level: "info",
              data: {
                query,
                paramCount: params.length,
              },
            });
          },
        };

        return drizzle({
          client: pool,
          relations: schema.schemaRelations,
          logger: drizzleLogger,
          jit: true,
        });
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
