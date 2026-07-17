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
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        let databaseUrl = config.get<string>("DB_URL");
        if (databaseUrl) {
          // WHY: Map legacy SSL modes to 'sslmode=verify-full' to suppress pg-connection-string warnings and ensure future-proof compatibility.
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

        return drizzle({
          client: pool,
          relations: schema.schemaRelations,
          jit: true,
        });
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
