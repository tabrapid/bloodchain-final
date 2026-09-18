/**
 * Event names and payloads for the three notification streams that had a
 * handler and no emitter.
 *
 * `NotificationEventHandler` has listened for `inventory.alert`,
 * `security.event`, `achievement.unlocked` and `level.up` since the module was
 * written, and nothing in the application ever emitted them -- so a blood
 * centre never heard that a unit had expired, a donor was never told their
 * password had changed, and unlocked achievements produced XP but no
 * notification. These are the contracts the emitters now write to; putting them
 * in one file rather than re-declaring the string at each `emit` is the same
 * shape as `appointment-notification.events.ts`.
 */

export const INVENTORY_ALERT_EVENT = 'inventory.alert';
export const SECURITY_EVENT = 'security.event';
export const ACHIEVEMENT_UNLOCKED_EVENT = 'achievement.unlocked';
export const LEVEL_UP_EVENT = 'level.up';

/**
 * One inventory alert, as the alert row records it.
 *
 * The alert's own id carries through as the notification's `sourceId` and the
 * basis of its idempotency key, so the hourly maintenance cron refreshing an
 * open alert cannot notify the same staff twice for the same alert.
 */
export interface InventoryAlertPayload {
  alertId: string;
  organizationId: string;
  /** `AlertType`: LOW_STOCK, EXPIRING_SOON, EXPIRED or QUARANTINED. */
  alertType: string;
  /** The message the domain already composed for the alert row. */
  message: string;
  bloodType?: string | null;
  rhFactor?: string | null;
  currentValue?: number | null;
  threshold?: number | null;
}

/**
 * A security-relevant action on one account.
 *
 * `occurrenceId` is what makes two of the same kind of event distinguishable.
 * The router's idempotency key used to be `SECURITY:<event>:<user>` with no
 * occurrence in it, so a second password change for the same account was
 * deduplicated against the first and the person was never told -- the exact
 * case a security notification exists for.
 */
export interface SecurityEventPayload {
  userId: string;
  /** e.g. PASSWORD_CHANGED, SESSION_REVOKED, ALL_SESSIONS_REVOKED. */
  eventType: string;
  /** The sentence shown to the account holder. */
  details: string;
  /** Unique per occurrence -- an audit-log id, a session id, or a timestamp. */
  occurrenceId: string;
}

export interface AchievementUnlockedPayload {
  achievementId: string;
  achievementName: string;
  userId: string;
}

export interface LevelUpPayload {
  userId: string;
  newLevel: number;
}
