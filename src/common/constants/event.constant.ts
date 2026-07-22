export const OUTBOX_EVENT_TYPE = {
  AUTH_VERIFICATION_EMAIL_REQUESTED: "auth.verification_email_requested",
  AUTH_RESET_PASSWORD_EMAIL_REQUESTED: "auth.reset_password_email_requested",
} as const;

export type OutboxEventType =
  (typeof OUTBOX_EVENT_TYPE)[keyof typeof OUTBOX_EVENT_TYPE];

export const MAIL_JOB_NAME = {
  SEND_VERIFICATION: "send-verification",
  SEND_RESET_PASSWORD: "send-reset-password",
} as const;

export type MailJobName = (typeof MAIL_JOB_NAME)[keyof typeof MAIL_JOB_NAME];
