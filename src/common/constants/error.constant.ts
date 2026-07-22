export const ERROR_MESSAGES = {
  TOO_MANY_REQUESTS: "Too Many Requests",
} as const;

export const PG_ERROR_CODE = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  NOT_NULL_VIOLATION: "23502",
} as const;
