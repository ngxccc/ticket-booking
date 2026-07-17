import { mock } from "bun:test";

export function createMockDb() {
  let selectResult: unknown[] = [];
  let selectResultsQueue: unknown[][] = [];
  const mockInsertValues = mock(() => Promise.resolve({}));
  const mockUpdateWhere = mock(() => Promise.resolve({}));
  const mockUpdateSet = mock(() => ({
    where: mockUpdateWhere,
  }));
  const mockUpdate = mock(() => ({
    set: mockUpdateSet,
  }));
  const mockDeleteWhere = mock(() => Promise.resolve({}));
  const mockDelete = mock(() => ({
    where: mockDeleteWhere,
  }));
  const mockDb = {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => {
            if (selectResultsQueue.length > 0) {
              const res = selectResultsQueue.shift();
              return Promise.resolve(res ?? selectResult);
            }
            return Promise.resolve(selectResult);
          }),
        })),
      })),
    })),
    insert: mock(() => ({
      values: mockInsertValues,
    })),
    update: mockUpdate,
    delete: mockDelete,
    mockInsertValues,
    mockUpdateSet,
    mockUpdateWhere,
    mockDeleteWhere,
    setSelectResult(result: unknown[]) {
      selectResult = result;
    },
    setSelectResultsQueue(results: unknown[][]) {
      selectResultsQueue = results;
    },
    clearAll() {
      this.select.mockClear();
      this.insert.mockClear();
      this.mockInsertValues.mockClear();
      this.update.mockClear();
      this.mockUpdateSet.mockClear();
      this.mockUpdateWhere.mockClear();
      this.delete.mockClear();
      this.mockDeleteWhere.mockClear();
      selectResult = [];
      selectResultsQueue = [];
    },
  };

  return mockDb;
}
