import { mock } from "bun:test";

export function createMockDb() {
  let selectResult: unknown[] = [];
  const mockInsertValues = mock(() => Promise.resolve({}));
  const mockUpdateWhere = mock(() => Promise.resolve({}));
  const mockUpdateSet = mock(() => ({
    where: mockUpdateWhere,
  }));
  const mockUpdate = mock(() => ({
    set: mockUpdateSet,
  }));
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
    update: mockUpdate,
    mockInsertValues,
    mockUpdateSet,
    mockUpdateWhere,
    setSelectResult(result: unknown[]) {
      selectResult = result;
    },
    clearAll() {
      this.select.mockClear();
      this.insert.mockClear();
      this.mockInsertValues.mockClear();
      this.update.mockClear();
      this.mockUpdateSet.mockClear();
      this.mockUpdateWhere.mockClear();
      selectResult = [];
    },
  };

  return mockDb;
}
