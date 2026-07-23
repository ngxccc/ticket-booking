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
  const mockDeleteReturning = mock(() => {
    if (selectResultsQueue.length > 0) {
      const res = selectResultsQueue.shift();
      return Promise.resolve(res ?? selectResult);
    }
    return Promise.resolve(selectResult);
  });
  const mockDeleteWhere = mock(() =>
    Object.assign(Promise.resolve({}), {
      returning: mockDeleteReturning,
    }),
  );
  const mockDelete = mock(() => ({
    where: mockDeleteWhere,
  }));
  const mockDb = {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => {
          const limitMock = mock(() => {
            const getResult = () => {
              if (selectResultsQueue.length > 0) {
                const res = selectResultsQueue.shift();
                return Promise.resolve(res ?? selectResult);
              }
              return Promise.resolve(selectResult);
            };
            const resultPromise = getResult();
            return Object.assign(resultPromise, {
              for: mock(() => resultPromise),
            });
          });
          return {
            limit: limitMock,
            for: mock(() => ({ limit: limitMock })),
          };
        }),
      })),
    })),
    insert: mock(() => ({
      values: mockInsertValues,
    })),
    update: mockUpdate,
    delete: mockDelete,
    transaction: mock((cb: (tx: unknown) => unknown) => cb(mockDb)),
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
      this.transaction.mockClear();
      selectResult = [];
      selectResultsQueue = [];
    },
  };

  return mockDb;
}
