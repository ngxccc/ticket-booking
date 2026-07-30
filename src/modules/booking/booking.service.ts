import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { eq, inArray, and } from "drizzle-orm";
import { ReserveSeatsDto } from "./dto/reserve-seats.dto";
import {
  DATABASE_CONNECTION,
  type DrizzleDB,
} from "../../database/database.module";
import { bookings, showSeats, shows, tickets } from "../../database/schemas";
import { RedlockService } from "../../common/services/redlock.service";
import { randomBytes } from "node:crypto";
import { getExpiryDate } from "@/common/utils/date.util";
import { I18nService } from "nestjs-i18n";
import type { I18nTranslations } from "@/generated/i18n.generated";

@Injectable()
export class BookingService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDB,
    private readonly redlockService: RedlockService,
    @InjectQueue("booking")
    private readonly bookingQueue: Queue,
    private readonly i18n: I18nService<I18nTranslations>,
  ) {}

  async reserveSeats(
    userId: string,
    dto: ReserveSeatsDto,
    idempotencyKey?: string,
  ) {
    if (dto.seatIds.length === 0) {
      throw new NotFoundException(
        this.i18n.t("booking.SEAT_NOT_BELONG_TO_SHOWTIME"),
      );
    }

    const sortedSeatIds = [...dto.seatIds].sort();
    const redis = this.redlockService.getRedisClient();

    // 1. Idempotency Check
    if (idempotencyKey) {
      try {
        const cached = await redis.get(
          `idempotency:booking:${userId}:${idempotencyKey}`,
        );
        if (cached) {
          return JSON.parse(cached) as Record<string, unknown>;
        }
      } catch {
        // WHY: Fail-open on idempotency read errors so Redis stream connection blips do not fail user requests with 500.
      }
    }

    // 2. Redlock Acquisition (RAM Layer Lock)
    const lockResources = sortedSeatIds.map(
      (seatId: string) => `lock:show_seat:${seatId}`,
    );
    let lock;
    try {
      lock = await this.redlockService.acquireLock(lockResources, 2000);
    } catch {
      throw new ConflictException(this.i18n.t("booking.SEATS_ALREADY_LOCKED"));
    }

    try {
      const now = new Date();
      const lockedUntil = getExpiryDate("10m");

      // 3. Database Transaction with Pessimistic Locking (SELECT ... FOR UPDATE)
      const result = await this.db.transaction(async (tx) => {
        // Validate show exists
        const [show] = await tx
          .select({
            id: shows.id,
            basePrice: shows.basePrice,
          })
          .from(shows)
          .where(eq(shows.id, dto.showId));

        if (!show) {
          throw new NotFoundException(
            this.i18n.t("booking.SHOWTIME_NOT_FOUND"),
          );
        }

        // Fetch show seats with FOR UPDATE lock
        const selectedSeats = await tx
          .select({
            id: showSeats.id,
            seatId: showSeats.seatId,
            status: showSeats.status,
            lockedUntil: showSeats.lockedUntil,
          })
          .from(showSeats)
          .where(
            and(
              eq(showSeats.showId, dto.showId),
              inArray(showSeats.seatId, sortedSeatIds),
            ),
          )
          .for("update");

        if (selectedSeats.length !== sortedSeatIds.length) {
          throw new NotFoundException(
            this.i18n.t("booking.SEAT_NOT_BELONG_TO_SHOWTIME"),
          );
        }

        // Verify all seats are available or expired
        const unavailable = selectedSeats.find((seat) => {
          if (seat.status === "booked") return true;
          if (
            seat.status === "reserved" &&
            seat.lockedUntil &&
            seat.lockedUntil > now
          ) {
            return true;
          }
          return false;
        });

        if (unavailable) {
          throw new ConflictException(
            this.i18n.t("booking.SEATS_NOT_AVAILABLE"),
          );
        }

        // Update show seats status to reserved
        await tx
          .update(showSeats)
          .set({
            status: "reserved",
            lockedUntil,
          })
          .where(
            and(
              eq(showSeats.showId, dto.showId),
              inArray(showSeats.seatId, sortedSeatIds),
            ),
          );

        // Calculate pricing
        const totalPrice = show.basePrice * sortedSeatIds.length;

        // Create booking record
        const [booking] = await tx
          .insert(bookings)
          .values({
            userId,
            showId: dto.showId,
            originalPrice: totalPrice,
            discountPrice: 0,
            totalPrice,
            status: "pending_payment",
            expiresAt: lockedUntil,
          })
          .returning({
            id: bookings.id,
            totalPrice: bookings.totalPrice,
            status: bookings.status,
          });

        if (!booking) {
          throw new ConflictException(this.i18n.t("booking.BOOKING_FAILED"));
        }

        // Create tickets
        const ticketValues = selectedSeats.map((seat) => ({
          bookingId: booking.id,
          showSeatId: seat.id,
          ticketCode: `TKT-${randomBytes(4).toString("hex").toUpperCase()}`,
          finalPrice: show.basePrice,
        }));

        await tx.insert(tickets).values(ticketValues);

        return {
          bookingId: booking.id,
          showId: dto.showId,
          totalPrice: booking.totalPrice,
          status: booking.status,
          expiresAt: lockedUntil.toISOString(),
          seats: sortedSeatIds,
        };
      });

      // 4. Enqueue BullMQ delayed cancellation job (600,000ms = 10 min)
      await this.bookingQueue.add(
        "cancel-booking",
        { bookingId: result.bookingId },
        {
          delay: 600000,
          jobId: `cancel-booking-${result.bookingId}`,
        },
      );

      // 5. Cache Idempotency Key (60s)
      if (idempotencyKey) {
        try {
          await redis.setex(
            `idempotency:booking:${userId}:${idempotencyKey}`,
            60,
            JSON.stringify(result),
          );
        } catch {
          // WHY: Fail-open on idempotency write errors to prevent Redis connection blips from throwing unhandled exceptions.
        }
      }

      return result;
    } finally {
      // Release Redlock in all code paths
      await this.redlockService.releaseLock(lock);
    }
  }
}
