import type { DrizzleDB } from "@/database/database.module";
import {
  cinemas,
  halls,
  seatTypes,
  seats,
  type TCinema,
  type TNewCinema,
  type THall,
  type TNewHall,
  type TSeatType,
  type TNewSeatType,
  type TSeat,
  type TNewSeat,
} from "@/database/schemas";

export async function createCinema(
  db: DrizzleDB,
  overrides: Partial<TNewCinema> = {},
): Promise<TCinema> {
  const [cinema] = await db
    .insert(cinemas)
    .values({
      name: `Cinema-${crypto.randomUUID().slice(0, 8)}`,
      address: "720A Dien Bien Phu, Binh Thanh, HCMC",
      ...overrides,
    })
    .returning();

  if (!cinema) {
    throw new Error("Failed to create Cinema entity in test factory");
  }
  return cinema;
}

export async function createHall(
  db: DrizzleDB,
  overrides: Partial<TNewHall> = {},
): Promise<THall> {
  const cinemaId = overrides.cinemaId ?? (await createCinema(db)).id;

  const [hall] = await db
    .insert(halls)
    .values({
      cinemaId,
      name: `Hall-${crypto.randomUUID().slice(0, 8)}`,
      totalSeats: 100,
      ...overrides,
    })
    .returning();

  if (!hall) {
    throw new Error("Failed to create Hall entity in test factory");
  }
  return hall;
}

export async function createSeatType(
  db: DrizzleDB,
  overrides: Partial<TNewSeatType> = {},
): Promise<TSeatType> {
  const [seatType] = await db
    .insert(seatTypes)
    .values({
      name: `SeatType-${crypto.randomUUID().slice(0, 8)}`,
      priceMultiplier: "1.00",
      ...overrides,
    })
    .returning();

  if (!seatType) {
    throw new Error("Failed to create SeatType entity in test factory");
  }
  return seatType;
}

export async function createSeat(
  db: DrizzleDB,
  overrides: Partial<TNewSeat> = {},
): Promise<TSeat> {
  const hallId = overrides.hallId ?? (await createHall(db)).id;
  const seatTypeId = overrides.seatTypeId ?? (await createSeatType(db)).id;

  const [seat] = await db
    .insert(seats)
    .values({
      hallId,
      seatTypeId,
      row: "A",
      number: 1,
      seatNumber: `A1-${crypto.randomUUID().slice(0, 4)}`,
      ...overrides,
    })
    .returning();

  if (!seat) {
    throw new Error("Failed to create Seat entity in test factory");
  }
  return seat;
}

export async function createBatchSeats(
  db: DrizzleDB,
  hallId: string,
  seatTypeId: string,
  count = 5,
  row = "A",
): Promise<TSeat[]> {
  const seatValues = Array.from({ length: count }, (_, idx) => ({
    hallId,
    seatTypeId,
    row,
    number: idx + 1,
    seatNumber: `${row}${(idx + 1).toString()}`,
  }));

  const inserted = await db.insert(seats).values(seatValues).returning();
  return inserted;
}
