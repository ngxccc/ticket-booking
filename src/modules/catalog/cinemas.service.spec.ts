import { beforeEach, describe, expect, it } from "bun:test";
import { CinemasService } from "./cinemas.service";
import type { DrizzleDB } from "@/database/database.module";
import { createMockDb } from "../../../test/mocks";

describe("CinemasService (Unit)", () => {
  let service: CinemasService;
  const mockDb = createMockDb();

  beforeEach(() => {
    mockDb.clearAll();
    service = new CinemasService(mockDb as unknown as DrizzleDB);
  });

  describe("findCinemas", () => {
    it("should return empty data array when total count is 0", async () => {
      mockDb.setSelectResult([{ count: 0 }]);

      const result = await service.findCinemas({
        page: 1,
        limit: 20,
        city: "NonExistentCity",
      });

      expect(result).toEqual({
        data: [],
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      });
    });
  });
});
