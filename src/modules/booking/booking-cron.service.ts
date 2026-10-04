import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ShowsService } from "../shows/shows.service";
import { Cron, CronExpression } from "@nestjs/schedule";
import { and, eq, inArray, lt } from "drizzle-orm";
import {
  DATABASE_CONNECTION,
  type DrizzleDB,
} from "../../database/database.module";
import { bookings, showSeats, tickets } from "../../database/schemas";

@Injectable()
export class BookingCronService {
  private readonly logger = new Logger(BookingCronService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDB,
    @Optional()
    private readonly showsService?: ShowsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCleanupExpiredSeatLocks(): Promise<void> {
    const now = new Date();
    this.logger.debug("Running backup cron cleanup for expired seat locks...");

    const affectedShowIds: string[] = [];
    await this.db.transaction(async (tx) => {
      // 1. Identify expired reserved show seats
      const expiredSeats = await tx
        .select({ id: showSeats.id, showId: showSeats.showId })
        .from(showSeats)
        .where(
          and(eq(showSeats.status, "reserved"), lt(showSeats.lockedUntil, now)),
        );

      if (expiredSeats.length === 0) {
        return;
      }

      const expiredSeatIds = expiredSeats.map((s) => s.id);
      affectedShowIds.push(
        ...Array.from(new Set(expiredSeats.map((s) => s.showId))),
      );

      // 2. Find linked tickets to update associated pending_payment bookings
      const linkedTickets = await tx
        .select({ bookingId: tickets.bookingId })
        .from(tickets)
        .where(inArray(tickets.showSeatId, expiredSeatIds));

      if (linkedTickets.length > 0) {
        const bookingIds = Array.from(
          new Set(linkedTickets.map((t) => t.bookingId)),
        );

        await tx
          .update(bookings)
          .set({ status: "expired" })
          .where(
            and(
              inArray(bookings.id, bookingIds),
              eq(bookings.status, "pending_payment"),
            ),
          );
      }

      // 3. Reset show_seats to available
      await tx
        .update(showSeats)
        .set({
          status: "available",
          lockedUntil: null,
        })
        .where(inArray(showSeats.id, expiredSeatIds));

      this.logger.log(
        `Backup cron cleaned up ${String(expiredSeats.length)} orphaned reserved seats`,
      );
    });

    // Deterministic Cache Invalidation: Invalidate show seating cache for all affected shows
    if (this.showsService && affectedShowIds.length > 0) {
      const showsService = this.showsService;
      await Promise.allSettled(
        affectedShowIds.map((showId) =>
          showsService.invalidateShowSeatsCache(showId),
        ),
      );
    }
  }
}
