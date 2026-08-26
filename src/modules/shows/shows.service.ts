import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import type { I18nTranslations } from "@/generated/i18n.generated";
import {
  DATABASE_CONNECTION,
  type DrizzleDB,
} from "@/database/database.module";
import { CreateShowDto } from "./dto/create-show.dto";
import { ShowResponseDto } from "./dto/show-response.dto";
import { halls, movies, seats, shows, showSeats } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { isPostgresErrorCode } from "@/common/utils/error.util";
import { PG_ERROR_CODE } from "@/common/constants/error.constant";
import type { BatchShowResponseDto, CreateShowBatchDto } from "./dto";
import { SHOWS_CONSTANTS } from "./shows.constants";
import { TIME_IN_MS } from "@/common/constants/time.constant";

@Injectable()
export class ShowsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDB,
    private readonly i18n: I18nService<I18nTranslations>,
  ) {}

  /**
   * Creates a single showtime and bulk pre-allocates all physical hall seats as available.
   *
   * @param dto Single show configuration containing movie, hall, start time, and base price
   * @returns Created show details including calculated end time and total seat count
   *
   * @invariant INV-1 (Schedule Collision & Cleaning Buffer): Enforces 15m cleaning buffer between shows via PostgreSQL GiST constraint
   * @invariant INV-2 (Lead Time Guard): Rejects shows scheduled earlier than now() + SHOW_CREATION_MIN_LEAD_MINUTES
   * @invariant INV-3 (Physical Seat Pre-allocation): Bulk pre-allocates all hall seats as available in the same transaction
   */
  async createShow(dto: CreateShowDto): Promise<ShowResponseDto> {
    const [[movie], [hall]] = await Promise.all([
      this.db
        .select({ id: movies.id, durationMinutes: movies.durationMinutes })
        .from(movies)
        .where(eq(movies.id, dto.movieId)),
      this.db
        .select({ id: halls.id })
        .from(halls)
        .where(eq(halls.id, dto.hallId)),
    ]);

    if (!movie) {
      throw new NotFoundException(this.i18n.t("shows.MOVIE_NOT_FOUND"));
    }
    if (!hall) {
      throw new NotFoundException(this.i18n.t("shows.HALL_NOT_FOUND"));
    }

    const startTime = new Date(dto.startTime);
    const minAllowedStartTime =
      Date.now() + SHOWS_CONSTANTS.MIN_LEAD_TIME_MINUTES * TIME_IN_MS.MINUTE;

    if (startTime.getTime() < minAllowedStartTime) {
      throw new BadRequestException(
        this.i18n.t("shows.PAST_SHOW_SLOT", {
          args: { minLeadTime: SHOWS_CONSTANTS.MIN_LEAD_TIME_MINUTES },
        }),
      );
    }

    const endTime = new Date(
      startTime.getTime() + movie.durationMinutes * TIME_IN_MS.MINUTE,
    );

    try {
      return await this.db.transaction(async (tx) => {
        const hallSeats = await tx
          .select({ id: seats.id })
          .from(seats)
          .where(eq(seats.hallId, dto.hallId));

        if (!hallSeats.length) {
          throw new BadRequestException(
            this.i18n.t("shows.NO_SEATS_CONFIGURED"),
          );
        }

        const [newShow] = await tx
          .insert(shows)
          .values({
            movieId: dto.movieId,
            hallId: dto.hallId,
            startTime,
            endTime,
            basePrice: dto.basePrice,
          })
          .returning({
            id: shows.id,
            movieId: shows.movieId,
            hallId: shows.hallId,
            startTime: shows.startTime,
            endTime: shows.endTime,
            basePrice: shows.basePrice,
          });

        if (!newShow) {
          throw new Error(this.i18n.t("shows.CREATE_SHOW_FAILED"));
        }

        await tx.insert(showSeats).values(
          hallSeats.map((seat) => ({
            showId: newShow.id,
            seatId: seat.id,
            status: "available" as const,
          })),
        );

        return {
          id: newShow.id,
          movieId: newShow.movieId,
          hallId: newShow.hallId,
          startTime: newShow.startTime.toISOString(),
          endTime: newShow.endTime.toISOString(),
          basePrice: newShow.basePrice,
          totalSeats: hallSeats.length,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;

      if (isPostgresErrorCode(error, PG_ERROR_CODE.EXCLUSION_VIOLATION)) {
        throw new ConflictException(this.i18n.t("shows.SCHEDULE_COLLISION"));
      }

      throw error;
    }
  }

  /**
   * Creates recurring batch showtimes across a date range and pre-allocates available seats.
   *
   * @param dto Batch configuration containing movie, hall, date span, and daily time slots
   * @returns Summary object containing createdCount and array of created show IDs
   *
   * @invariant INV-1 (Schedule Collision & Cleaning Buffer): Enforces 15m cleaning buffer between shows via 1D timeline & PostgreSQL GiST constraint
   * @invariant INV-2 (Lead Time Guard): Rejects shows scheduled earlier than now() + SHOW_CREATION_MIN_LEAD_MINUTES
   * @invariant INV-3 (Physical Seat Pre-allocation): Chunked bulk pre-allocates hall seats in 1,000-row chunks
   * @invariant INV-4 (All-or-Nothing Batch Atomicity): Entire batch rolls back cleanly if any single slot collides
   */
  async createShowBatch(
    dto: CreateShowBatchDto,
  ): Promise<BatchShowResponseDto> {
    const [[movie], [hall]] = await Promise.all([
      this.db
        .select({ id: movies.id, durationMinutes: movies.durationMinutes })
        .from(movies)
        .where(eq(movies.id, dto.movieId)),
      this.db
        .select({ id: halls.id })
        .from(halls)
        .where(eq(halls.id, dto.hallId)),
    ]);

    if (!movie) {
      throw new NotFoundException(this.i18n.t("shows.MOVIE_NOT_FOUND"));
    }

    if (!hall) {
      throw new NotFoundException(this.i18n.t("shows.HALL_NOT_FOUND"));
    }

    const slots = this.expandAndValidateTimeline(dto, movie.durationMinutes);
    try {
      // WHY: Single DB transaction ensures all-or-nothing atomicity; failure on any slot rolls back all created shows and seats.
      return await this.db.transaction(async (tx) => {
        const hallSeats = await tx
          .select({ id: seats.id })
          .from(seats)
          .where(eq(seats.hallId, dto.hallId));

        if (!hallSeats.length) {
          throw new BadRequestException(
            this.i18n.t("shows.NO_SEATS_CONFIGURED"),
          );
        }

        const createdShows = await tx
          .insert(shows)
          .values(
            slots.map((s) => ({
              movieId: dto.movieId,
              hallId: dto.hallId,
              startTime: s.startTime,
              endTime: s.endTime,
              basePrice: dto.basePrice,
            })),
          )
          .returning({ id: shows.id });

        // WHY: Bulk inserting show_seats in 1,000-row chunks prevents exceeding PostgreSQL prepared statement parameter limits (65,535).
        const allShowSeats = createdShows.flatMap((show) =>
          hallSeats.map((seat) => ({
            showId: show.id,
            seatId: seat.id,
            status: "available" as const,
          })),
        );

        for (
          let i = 0;
          i < allShowSeats.length;
          i += SHOWS_CONSTANTS.SEAT_PREALLOCATION_CHUNK_SIZE
        ) {
          const chunk = allShowSeats.slice(
            i,
            i + SHOWS_CONSTANTS.SEAT_PREALLOCATION_CHUNK_SIZE,
          );
          await tx.insert(showSeats).values(chunk);
        }

        return {
          createdCount: createdShows.length,
          showIds: createdShows.map((s) => s.id),
        };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;

      // WHY: Postgres error 23P01 indicates GiST exclusion constraint collision, mapped to HTTP 409 Conflict.
      if (isPostgresErrorCode(error, PG_ERROR_CODE.EXCLUSION_VIOLATION)) {
        throw new ConflictException(this.i18n.t("shows.SCHEDULE_COLLISION"));
      }

      throw error;
    }
  }

  /**
   * Expands recurring date range and time slots into a 1D flat timeline and validates intra-batch collisions.
   *
   * @param dto Batch configuration containing date span and daily time slots
   * @param durationMinutes Movie duration in minutes
   * @returns Array of validated, chronologically sorted show time slots with occupied intervals
   *
   * @invariant INV-1 (Schedule Collision & Cleaning Buffer): Enforces 15m cleaning buffer between slots
   * @invariant INV-2 (Lead Time Guard): Rejects slots scheduled earlier than now() + SHOW_CREATION_MIN_LEAD_MINUTES
   */
  expandAndValidateTimeline(
    dto: CreateShowBatchDto,
    durationMinutes: number,
  ): { startTime: Date; endTime: Date; occupiedEnd: Date }[] {
    // WHY: Calendar UTC arithmetic prevents 1-day backward drift when converting Asia/Ho_Chi_Minh dates.
    const [sYear, sMonth, sDay] = dto.startDate.split("-").map(Number);
    const [eYear, eMonth, eDay] = dto.endDate.split("-").map(Number);

    if (!sYear || !sMonth || !sDay || !eYear || !eMonth || !eDay) {
      throw new BadRequestException(this.i18n.t("shows.INVALID_DATE_RANGE"));
    }

    const startUtc = new Date(Date.UTC(sYear, sMonth - 1, sDay));
    const endUtc = new Date(Date.UTC(eYear, eMonth - 1, eDay));

    if (startUtc.getTime() > endUtc.getTime()) {
      throw new BadRequestException(this.i18n.t("shows.INVALID_DATE_RANGE"));
    }

    const diffDays =
      Math.round((endUtc.getTime() - startUtc.getTime()) / TIME_IN_MS.DAY) + 1;

    // WHY: Hard guardrails (max 30 days, max 100 shows) prevent memory exhaustion and long-running DB transaction locks.
    if (diffDays > SHOWS_CONSTANTS.MAX_BATCH_DAYS) {
      throw new BadRequestException(
        this.i18n.t("shows.MAX_DAYS_EXCEEDED", {
          args: { maxDays: SHOWS_CONSTANTS.MAX_BATCH_DAYS },
        }),
      );
    }

    const totalExpectedShows = diffDays * dto.timeSlots.length;
    if (totalExpectedShows > SHOWS_CONSTANTS.MAX_BATCH_SHOWS) {
      throw new BadRequestException(
        this.i18n.t("shows.MAX_SHOWS_EXCEEDED", {
          args: { maxShows: SHOWS_CONSTANTS.MAX_BATCH_SHOWS },
        }),
      );
    }

    const slots: { startTime: Date; endTime: Date; occupiedEnd: Date }[] = [];
    const minAllowedStartTime =
      Date.now() + SHOWS_CONSTANTS.MIN_LEAD_TIME_MINUTES * TIME_IN_MS.MINUTE;

    for (let d = 0; d < diffDays; d++) {
      const currentDayUtc = new Date(Date.UTC(sYear, sMonth - 1, sDay + d));
      const yearStr = String(currentDayUtc.getUTCFullYear());
      const monthStr = String(currentDayUtc.getUTCMonth() + 1).padStart(2, "0");
      const dayStr = String(currentDayUtc.getUTCDate()).padStart(2, "0");
      // WHY: Zero-padding ensures strict ISO 8601 (YYYY-MM-DD) formatting to prevent invalid date string parsing.
      const dateStr = `${yearStr}-${monthStr}-${dayStr}`;

      for (const slot of dto.timeSlots) {
        const slotStartTime = new Date(
          `${dateStr}T${slot}:00${SHOWS_CONSTANTS.TIMEZONE_OFFSET}`,
        );

        if (slotStartTime.getTime() < minAllowedStartTime) {
          throw new BadRequestException(
            this.i18n.t("shows.PAST_SHOW_SLOT", {
              args: { minLeadTime: SHOWS_CONSTANTS.MIN_LEAD_TIME_MINUTES },
            }),
          );
        }

        const slotEndTime = new Date(
          slotStartTime.getTime() + durationMinutes * TIME_IN_MS.MINUTE,
        );
        const occupiedEnd = new Date(
          slotEndTime.getTime() +
            SHOWS_CONSTANTS.CLEANING_BUFFER_MINUTES * TIME_IN_MS.MINUTE,
        );

        slots.push({
          startTime: slotStartTime,
          endTime: slotEndTime,
          occupiedEnd,
        });
      }
    }

    // WHY: Sorting timeline chronologically allows O(N) intra-batch overlap detection before opening a DB transaction.
    slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    for (let i = 0; i < slots.length; ++i) {
      const currentSlot = slots[i];
      const nextSlot = slots[i + 1];

      if (
        nextSlot &&
        currentSlot &&
        nextSlot.startTime.getTime() < currentSlot.occupiedEnd.getTime()
      ) {
        throw new BadRequestException(
          this.i18n.t("shows.INTRA_BATCH_COLLISION"),
        );
      }
    }

    return slots;
  }
}
