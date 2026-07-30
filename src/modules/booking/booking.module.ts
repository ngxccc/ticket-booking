import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ScheduleModule } from "@nestjs/schedule";
import { RedlockService } from "../../common/services/redlock.service";
import { BookingController } from "./booking.controller";
import { BookingService } from "./booking.service";
import { BookingCancellationProcessor } from "./processors/booking-cancellation.processor";
import { BookingCronService } from "./booking-cron.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "booking",
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: {
          count: 1000,
        },
      },
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [BookingController],
  providers: [
    BookingService,
    RedlockService,
    BookingCancellationProcessor,
    BookingCronService,
  ],
  exports: [BookingService, RedlockService],
})
export class BookingModule {}
