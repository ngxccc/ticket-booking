import { mock } from "bun:test";

export function createMockDb() {
  let selectResult: unknown[] = [];
  const mockInsertValues = mock(() => Promise.resolve({}));

  const mockDb = {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => Promise.resolve(selectResult)),
        })),
      })),
    })),
    insert: mock(() => ({
      values: mockInsertValues,
    })),
    mockInsertValues,
    setSelectResult(result: unknown[]) {
      selectResult = result;
    },
    clearAll() {
      this.select.mockClear();
      this.insert.mockClear();
      this.mockInsertValues.mockClear();
      selectResult = [];
    },
  };

  return mockDb;
}
