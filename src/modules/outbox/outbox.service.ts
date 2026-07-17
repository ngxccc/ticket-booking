import {
  Injectable,
  Logger,
  Inject,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  DATABASE_CONNECTION,
  type DrizzleDB,
} from "@/database/database.module";
import { outboxEvents } from "@/database/schemas";
import { eq } from "drizzle-orm";
import { OUTBOX_EVENT_TYPE } from "@/common/constants/event.constant";

@Injectable()
export class OutboxService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxService.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDB,
    @InjectQueue("mail")
    private readonly mailQueue: Queue,
  ) {}

  onApplicationBootstrap() {
    // WHY: Polling interval of 5 seconds to process outbox events while keeping DB CPU usage low.
    this.timer = setInterval(() => {
      void this.processOutbox();
    }, 5000);
    this.logger.log("Outbox Relay Worker started polling.");
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.log("Outbox Relay Worker stopped polling.");
  }

  async processOutbox() {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    try {
      const pendingEvents = await this.db
        .select()
        .from(outboxEvents)
        .where(eq(outboxEvents.status, "pending"))
        .limit(10); // Process in batches of 10

      if (pendingEvents.length === 0) {
        this.isProcessing = false;
        return;
      }

      this.logger.log(
        `Processing ${String(pendingEvents.length)} pending outbox events...`,
      );

      for (const event of pendingEvents) {
        try {
          await this.dispatch(event.eventType, event.payload);

          await this.db
            .update(outboxEvents)
            .set({
              status: "processed",
              processedAt: new Date(),
            })
            .where(eq(outboxEvents.id, event.id));

          this.logger.log(
            `Event ${event.id} (${event.eventType}) processed successfully.`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to process event ${event.id} (${event.eventType})`,
            error,
          );

          await this.db
            .update(outboxEvents)
            .set({
              status: "failed",
            })
            .where(eq(outboxEvents.id, event.id));
        }
      }
    } catch (error) {
      this.logger.error("Error occurred during outbox processing", error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async dispatch(eventType: string, payload: unknown) {
    switch (eventType) {
      case OUTBOX_EVENT_TYPE.AUTH_VERIFICATION_EMAIL_REQUESTED:
        await this.mailQueue.add("send-verification", payload);
        break;
      default:
        throw new Error(`Unsupported event type: ${eventType}`);
    }
  }
}
