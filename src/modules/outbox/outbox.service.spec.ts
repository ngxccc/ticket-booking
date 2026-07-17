import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { OutboxService } from "./outbox.service";
import { DATABASE_CONNECTION } from "@/database/database.module";
import { getQueueToken } from "@nestjs/bullmq";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createMockDb } from "../../../test/mocks";
import { OUTBOX_EVENT_TYPE } from "@/common/constants/event.constant";

const mockQueue = {
  add: mock(() => Promise.resolve({})),
  clearAll() {
    this.add.mockClear();
  },
};

describe("OutboxService", () => {
  let service: OutboxService;
  const mockDb = createMockDb();

  beforeEach(async () => {
    mockDb.clearAll();
    mockQueue.clearAll();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: getQueueToken("mail"),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<OutboxService>(OutboxService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should process pending outbox events, dispatch them, and mark them as processed", async () => {
    const mockEvent = {
      id: "event-uuid",
      eventType: OUTBOX_EVENT_TYPE.AUTH_VERIFICATION_EMAIL_REQUESTED,
      payload: {
        email: "test@example.com",
        fullName: "Test User",
        token: "token123",
      },
      status: "pending",
      createdAt: new Date(),
    };

    mockDb.setSelectResult([mockEvent]);

    await service.processOutbox();

    expect(mockDb.select).toHaveBeenCalled();
    expect(mockQueue.add).toHaveBeenCalledWith(
      "send-verification",
      mockEvent.payload,
    );
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "processed",
        processedAt: expect.any(Date) as unknown as Date,
      }),
    );
  });

  it("should mark outbox event as failed if dispatching throws an error", async () => {
    const mockEvent = {
      id: "event-uuid",
      eventType: OUTBOX_EVENT_TYPE.AUTH_VERIFICATION_EMAIL_REQUESTED,
      payload: {
        email: "test@example.com",
        fullName: "Test User",
        token: "token123",
      },
      status: "pending",
      createdAt: new Date(),
    };

    mockDb.setSelectResult([mockEvent]);
    mockQueue.add.mockImplementationOnce(() =>
      Promise.reject(new Error("Queue error")),
    );

    await service.processOutbox();

    expect(mockDb.select).toHaveBeenCalled();
    expect(mockQueue.add).toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
      }),
    );
  });
});
