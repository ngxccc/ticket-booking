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
        const databaseUrl = config.get<string>("DB_URL");
        const pool = databaseUrl
          ? new Pool({
              connectionString: databaseUrl,
              ssl: {
                rejectUnauthorized: false,
              },
            })
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
