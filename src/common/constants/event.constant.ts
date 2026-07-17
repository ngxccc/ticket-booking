export const OUTBOX_EVENT_TYPE = {
  AUTH_VERIFICATION_EMAIL_REQUESTED: "auth.verification_email_requested",
} as const;

export type OutboxEventType =
  (typeof OUTBOX_EVENT_TYPE)[keyof typeof OUTBOX_EVENT_TYPE];
