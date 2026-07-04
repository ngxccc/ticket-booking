import {
  index,
  integer,
  jsonb,
  snakeCase,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings.schema";
import {
  outboxEventStatusEnum,
  paymentMethodEnum,
  paymentStatusEnum,
} from "./enums.schema";
import { baseEntity, primaryKeyUuid } from "./helpers.schema";

export const payments = snakeCase.table(
  "payments",
  {
    ...baseEntity,
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    paymentMethod: paymentMethodEnum().notNull(),
    transactionId: varchar({ length: 255 }),
    amount: integer().notNull(),
    status: paymentStatusEnum().notNull(),
  },
  (table) => [
    uniqueIndex("payments_transaction_id_uidx").on(table.transactionId),
    index("payments_booking_id_idx").on(table.bookingId),
  ],
);

export const outboxEvents = snakeCase.table(
  "outbox_events",
  {
    ...primaryKeyUuid,
    createdAt: timestamp({ withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    eventType: varchar({ length: 255 }).notNull(),
    payload: jsonb().notNull(),
    status: outboxEventStatusEnum().default("pending").notNull(),
    processedAt: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("outbox_events_status_created_at_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export type TPayment = typeof payments.$inferSelect;
export type TNewPayment = typeof payments.$inferInsert;
export type TOutboxEvent = typeof outboxEvents.$inferSelect;
export type TNewOutboxEvent = typeof outboxEvents.$inferInsert;
