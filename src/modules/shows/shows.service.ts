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

@Injectable()
export class ShowsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDB,
    private readonly i18n: I18nService<I18nTranslations>,
  ) {}

  /**
   * Create a single show and bulk pre-allocate available seats within a transaction.
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
    const endTime = new Date(
      startTime.getTime() + movie.durationMinutes * 60 * 1000,
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
}
