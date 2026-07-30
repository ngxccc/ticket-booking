import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Test, type TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { I18nService } from "nestjs-i18n";
import { BookingService } from "./booking.service";
import { DATABASE_CONNECTION } from "../../database/database.module";
import { RedlockService } from "../../common/services/redlock.service";
import {
  createMockI18nService,
  createMockRedlockService,
  createMockQueue,
} from "../../../test/mocks";

interface MockTx {
  select: ReturnType<typeof mock>;
  update: ReturnType<typeof mock>;
  insert: ReturnType<typeof mock>;
}

interface MockDb {
  transaction: ReturnType<typeof mock>;
}

describe("BookingService", () => {
  let service: BookingService;
  const mockI18nService = createMockI18nService();
  let mockRedlockService: ReturnType<typeof createMockRedlockService>;
  let mockBookingQueue: ReturnType<typeof createMockQueue>;
  let mockRedis: typeof mockRedlockService.mockRedis;
  let mockTx: MockTx;
  let mockDb: MockDb;
  beforeEach(async () => {
    mockI18nService.clearAll();
    mockRedlockService = createMockRedlockService();
    mockRedis = mockRedlockService.mockRedis;
    mockBookingQueue = createMockQueue();
    mockTx = {
      select: mock(() => ({
        from: mock(() => ({
          where: mock(() => {
            const resPromise = Promise.resolve([]);
            return Object.assign(resPromise, {
              for: mock(() => Promise.resolve([])),
            });
          }),
        })),
      })),
      update: mock(() => ({
        set: mock(() => ({
          where: mock(() => Promise.resolve([])),
        })),
      })),
      insert: mock(() => ({
        values: mock(() => ({
          returning: mock(() => Promise.resolve([])),
        })),
      })),
    };

    mockDb = {
      transaction: mock((cb: (tx: MockTx) => Promise<unknown>) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: RedlockService,
          useValue: mockRedlockService,
        },
        {
          provide: getQueueToken("booking"),
          useValue: mockBookingQueue,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("reserveSeats", () => {
    const userId = "user-uuid-123";
    const dto = {
      showId: "show-uuid-456",
      seatIds: ["seat-1", "seat-2"],
    };

    it("should throw NotFoundException when seatIds is empty array", () => {
      expect(
        service.reserveSeats(userId, { ...dto, seatIds: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return cached payload when idempotencyKey is found for user", async () => {
      const cachedResult = { bookingId: "cached-booking-123" };
      mockRedis.get.mockImplementation(() =>
        Promise.resolve(JSON.stringify(cachedResult)),
      );

      const result = await service.reserveSeats(userId, dto, "idempotency-123");

      expect(result).toEqual(cachedResult);
      expect(mockRedis.get).toHaveBeenCalledWith(
        `idempotency:booking:${userId}:idempotency-123`,
      );
      expect(mockRedlockService.acquireLock).not.toHaveBeenCalled();
    });

    it("should throw ConflictException when redlock acquisition fails", () => {
      mockRedlockService.acquireLock.mockImplementation(() =>
        Promise.reject(new Error("Lock failed")),
      );

      expect(service.reserveSeats(userId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should throw NotFoundException when showtime is not found", () => {
      mockTx.select.mockImplementation(() => ({
        from: mock(() => ({
          where: mock(() => Promise.resolve([])),
        })),
      }));

      expect(service.reserveSeats(userId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw NotFoundException when selected seats count does not match dto", () => {
      let callCount = 0;
      mockTx.select.mockImplementation(() => ({
        from: mock(() => ({
          where: mock(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ id: dto.showId, basePrice: 100000 }]);
            }
            const resPromise = Promise.resolve([
              { id: "ss-1", seatId: "seat-1", status: "available" },
            ]);
            return Object.assign(resPromise, {
              for: mock(() => resPromise),
            });
          }),
        })),
      }));

      expect(service.reserveSeats(userId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw ConflictException when requested seat is already booked", () => {
      let callCount = 0;
      mockTx.select.mockImplementation(() => ({
        from: mock(() => ({
          where: mock(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ id: dto.showId, basePrice: 100000 }]);
            }
            const resPromise = Promise.resolve([
              { id: "ss-1", seatId: "seat-1", status: "available" },
              { id: "ss-2", seatId: "seat-2", status: "booked" },
            ]);
            return Object.assign(resPromise, {
              for: mock(() => resPromise),
            });
          }),
        })),
      }));

      expect(service.reserveSeats(userId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should throw ConflictException when requested seat is reserved and not expired", () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      let callCount = 0;
      mockTx.select.mockImplementation(() => ({
        from: mock(() => ({
          where: mock(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ id: dto.showId, basePrice: 100000 }]);
            }
            const resPromise = Promise.resolve([
              { id: "ss-1", seatId: "seat-1", status: "available" },
              {
                id: "ss-2",
                seatId: "seat-2",
                status: "reserved",
                lockedUntil: futureDate,
              },
            ]);
            return Object.assign(resPromise, {
              for: mock(() => resPromise),
            });
          }),
        })),
      }));

      expect(service.reserveSeats(userId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should allow reservation if seat status is reserved but lockedUntil is null or past", async () => {
      let callCount = 0;
      mockTx.select.mockImplementation(() => ({
        from: mock(() => ({
          where: mock(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ id: dto.showId, basePrice: 100000 }]);
            }
            const resPromise = Promise.resolve([
              { id: "ss-1", seatId: "seat-1", status: "available" },
              {
                id: "ss-2",
                seatId: "seat-2",
                status: "reserved",
                lockedUntil: null,
              },
            ]);
            return Object.assign(resPromise, {
              for: mock(() => resPromise),
            });
          }),
        })),
      }));

      mockTx.insert.mockImplementation(() => ({
        values: mock(() => ({
          returning: mock(() =>
            Promise.resolve([
              {
                id: "booking-789",
                totalPrice: 200000,
                status: "pending_payment",
              },
            ]),
          ),
        })),
      }));

      const result = await service.reserveSeats(userId, dto);
      expect(result).toBeDefined();
      expect(result.bookingId).toBe("booking-789");
    });

    it("should throw ConflictException when booking creation returns empty", () => {
      let callCount = 0;
      mockTx.select.mockImplementation(() => ({
        from: mock(() => ({
          where: mock(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ id: dto.showId, basePrice: 100000 }]);
            }
            const resPromise = Promise.resolve([
              { id: "ss-1", seatId: "seat-1", status: "available" },
              { id: "ss-2", seatId: "seat-2", status: "available" },
            ]);
            return Object.assign(resPromise, {
              for: mock(() => resPromise),
            });
          }),
        })),
      }));

      mockTx.insert.mockImplementation(() => ({
        values: mock(() => ({
          returning: mock(() => Promise.resolve([])),
        })),
      }));

      expect(service.reserveSeats(userId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should successfully reserve seats, update DB, enqueue cancellation job, and set user-namespaced idempotency cache", async () => {
      let callCount = 0;
      mockTx.select.mockImplementation(() => ({
        from: mock(() => ({
          where: mock(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([{ id: dto.showId, basePrice: 100000 }]);
            }
            const resPromise = Promise.resolve([
              { id: "ss-1", seatId: "seat-1", status: "available" },
              { id: "ss-2", seatId: "seat-2", status: "available" },
            ]);
            return Object.assign(resPromise, {
              for: mock(() => resPromise),
            });
          }),
        })),
      }));

      mockTx.insert.mockImplementation(() => ({
        values: mock(() => ({
          returning: mock(() =>
            Promise.resolve([
              {
                id: "booking-789",
                totalPrice: 200000,
                status: "pending_payment",
              },
            ]),
          ),
        })),
      }));

      const result = await service.reserveSeats(
        userId,
        dto,
        "idempotency-key-xyz",
      );

      expect(result).toBeDefined();
      expect(result.bookingId).toBe("booking-789");
      expect(result.totalPrice).toBe(200000);
      expect(result.status).toBe("pending_payment");
      expect(mockBookingQueue.add).toHaveBeenCalledWith(
        "cancel-booking",
        { bookingId: "booking-789" },
        expect.objectContaining({ delay: 600000 }),
      );
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `idempotency:booking:${userId}:idempotency-key-xyz`,
        60,
        JSON.stringify(result),
      );
      expect(mockRedlockService.releaseLock).toHaveBeenCalled();
    });
  });
});
