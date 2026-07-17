import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { OutboxService } from "./outbox.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "mail",
    }),
  ],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
