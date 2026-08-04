ALTER TYPE "payment_method" ADD VALUE 'PAYOS';--> statement-breakpoint
ALTER TYPE "payment_status" ADD VALUE 'requires_refund';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "order_code" bigint;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_order_code_uidx" ON "bookings" ("order_code");