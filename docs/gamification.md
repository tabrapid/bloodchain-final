# Gamification System - Phase 13

## Overview

The gamification system encourages consistent, safe, voluntary blood donation and positive participation in the DONOR ecosystem through XP, levels, achievements, badges, and leaderboards.

## Important Safety Principles

- **NEVER encourage unsafe donation frequency** - The system does NOT reward donations before medical eligibility
- **NEVER diagnose or make health claims** - Gamification does not imply medical health
- **Medical eligibility comes from healthcare professionals** - Not from gamification data
- **No punishment for medical ineligibility** - Donors who cannot donate for medical reasons are NOT penalized

## XP System

### XP Sources

| Action | XP Awarded |
|--------|------------|
| Blood Donation Completed | 50 XP |
| Emergency Blood Donation | 75 XP |
| Blood Test Completed | 20 XP |
| Appointment Completed | 15 XP |
| Profile Completed | 25 XP |
| Achievement Unlocked | Variable (per achievement) |
| Emergency Response Accepted | 25 XP |

### XP Configuration

All XP values are centralized in `apps/api/src/modules/gamification/config/gamification.config.ts`:

```typescript
export const XP_CONFIG = {
  DONATION_COMPLETED: 50,
  EMERGENCY_DONATION_COMPLETED: 75,
  BLOOD_TEST_COMPLETED: 20,
  APPOINTMENT_COMPLETED: 15,
  PROFILE_COMPLETED: 25,
  ACHIEVEMENT_UNLOCKED: 10,
  EMERGENCY_RESPONSE_ACCEPTED: 25,
  STREAK_BONUS: 5,
} as const;
```

## XP Transaction Ledger

All XP changes are recorded in an immutable ledger:

```typescript
model XpTransaction {
  id          String          @id @default(cuid())
  userId      String
  amount      Int              // Positive or negative
  type        XpTransactionType
  sourceType  String?          // e.g., 'DONATION', 'BLOOD_TEST'
  sourceId    String?          // e.g., donation ID
  description String?
  metadata    Json?
  createdAt   DateTime        @default(now())
}
```

### Idempotency

XP transactions use a unique constraint on `(sourceType, sourceId)` to prevent duplicate awards. The same donation event will NEVER award XP twice.

## Level System

### Level Thresholds

| Level | Name | XP Required |
|-------|------|------------|
| 1 | New Donor | 0 |
| 2 | Active Donor | 100 |
| 3 | Regular Donor | 250 |
| 4 | Community Donor | 500 |
| 5 | Dedicated Donor | 1,000 |
| 6 | Champion | 2,000 |
| 7 | Elite Donor | 3,500 |
| 8 | Hero | 5,500 |
| 9 | Legend | 8,000 |
| 10 | Platinum | 11,000 |

### Level Calculation

```typescript
calculateLevelFromXp(xp: number): number {
  // Deterministic calculation from XP thresholds
  // No client-side manipulation allowed
}
```

## Achievement System

### Achievement Types

- `DONATION_COUNT` - Based on total completed donations
- `EMERGENCY_RESPONSE_COUNT` - Based on successful emergency responses
- `BLOOD_TEST_COUNT` - Based on completed blood tests
- `APPOINTMENT_COMPLETION_COUNT` - Based on attended appointments
- `XP_MILESTONE` - Based on total XP earned
- `STREAK` - Based on consistent activity within timeframe
- `CUSTOM_EVENT` - For special events

### Default Achievements

| Code | Name | Description | Target | XP Reward | Rarity |
|------|------|-------------|--------|-----------|---------|
| FIRST_DONATION | First Donation | Complete your first blood donation | 1 | 25 | COMMON |
| FIFTH_DONATION | Five Times a Hero | Complete 5 blood donations | 5 | 50 | RARE |
| TENTH_DONATION | Decade of Dedication | Complete 10 blood donations | 10 | 100 | EPIC |
| TWENTIETH_DONATION | Lifeline | Complete 20 blood donations | 20 | 200 | LEGENDARY |
| EMERGENCY_RESPONDER | Emergency Responder | Respond to an emergency request | 1 | 75 | RARE |
| FIRST_BLOOD_TEST | Health Explorer | Complete your first blood test | 1 | 20 | COMMON |
| XP_MILESTONE_500 | Rising Star | Earn 500 XP | 500 | 50 | RARE |
| XP_MILESTONE_2000 | Superstar | Earn 2000 XP | 2000 | 100 | EPIC |

### Achievement Unlock Logic

```typescript
// Pseudo-code
if (currentProgress >= target AND not already unlocked) {
  create AchievementUnlock record
  award XP reward
  check for badge
}
```

## Badge System

Badges are visual representations of achievements.

### Badge Rarities

- `COMMON` - Gray styling
- `RARE` - Blue styling
- `EPIC` - Purple styling
- `LEGENDARY` - Gold styling

Rarity is cosmetic only - it does NOT imply medical importance.

## Reputation System

Reputation represents platform contribution and reliability, NOT medical health.

### Reputation Sources

| Action | Reputation Points |
|--------|-----------------|
| Verified Donation | +10 |
| Emergency Response | +15 |
| Appointment Attendance | +5 |

### Reputation Levels

| Level | Name | Score Range |
|-------|------|-------------|
| 1 | New | 0-49 |
| 2 | Trusted Contributor | 50-149 |
| 3 | Community Contributor | 150-299 |
| 4 | Reliable Donor | 300-499 |
| 5 | Community Champion | 500+ |

## Leaderboard

### Leaderboard Types

- **All Time** - Total XP since account creation
- **This Year** - XP earned in current year
- **This Month** - XP earned in current month

### Privacy

- Users can opt out of public leaderboard visibility
- Default visibility is `true`
- Only public profile data is shown (name, avatar, level, XP, donation count)

### Ranking

Deterministic sorting:
1. Primary: XP descending
2. Secondary: Donation count descending
3. Tertiary: Earlier achievement date

## Event Integration

Gamification is event-driven. The system listens for:

| Event | Trigger |
|-------|---------|
| `DONATION_COMPLETED_EVENT` | When a donation is confirmed by hospital/staff |
| `BLOOD_TEST_COMPLETED_EVENT` | When a blood test result is published |
| `APPOINTMENT_COMPLETED_EVENT` | When an appointment is marked completed |

### Event Handler

```typescript
@OnEvent(DONATION_COMPLETED_EVENT)
async handleDonationCompleted(payload: DonationCompletedPayload) {
  // 1. Verify donation completion (anti-abuse)
  // 2. Check idempotency
  // 3. Award XP
  // 4. Update level
  // 5. Check achievements
  // 6. Award badges
  // 7. Create notifications
}
```

## Anti-Abuse Protection

### Protections

1. **Idempotency** - Same event cannot award XP twice
2. **Donation Frequency** - Maximum 4 donations per month enforced
3. **XP Transaction Rate Limiting** - Maximum 10 non-admin XP transactions per hour
4. **Rapid XP Detection** - Flags suspicious rapid XP gains for review
5. **Verified Completion Only** - Only verified donations/blood tests count

### Verification

Before awarding XP, the system verifies:
- Donation status is `COMPLETED`
- Completion was recorded by authorized staff
- No duplicate transaction exists

## API Endpoints

### Gamification Profile

```
GET /api/v1/me/gamification
GET /api/v1/me/gamification/progress
GET /api/v1/me/gamification/xp?page=1&limit=20
GET /api/v1/me/gamification/achievements
GET /api/v1/me/gamification/badges
GET /api/v1/me/gamification/stats
POST /api/v1/me/gamification/leaderboard-visibility
```

### Leaderboard

```
GET /api/v1/leaderboard?timeRange=ALL_TIME&page=1&limit=10
GET /api/v1/leaderboard/me?timeRange=ALL_TIME
```

## Mobile Screens

| Screen | Route |
|--------|-------|
| Gamification Hub | `/gamification` |
| Achievements | `/gamification/achievements` |
| Badges | `/gamification/badges` |
| Leaderboard | `/gamification/leaderboard` |

## Security

### Client Cannot

- Set XP directly
- Unlock achievements
- Modify reputation
- Change leaderboard scores
- Fake donation completions

### Admin Capabilities

Authorized admins can:
- Create XP adjustments (creates compensating transaction)
- Create reputation adjustments
- View gamification audit logs

All manual adjustments require:
- Admin ID
- Reason (required)
- Are recorded in audit log

## Database Schema

### New Models

- `GamificationProfile` - User's gamification state (XP, level, reputation)
- `XpTransaction` - Immutable XP ledger
- `Achievement` - Achievement definitions
- `AchievementUnlock` - User's unlocked achievements
- `Badge` - Badge definitions
- `UserBadge` - User's earned badges
- `ReputationTransaction` - Reputation ledger

### New Enums

- `AchievementType` - DONATION_COUNT, EMERGENCY_RESPONSE_COUNT, BLOOD_TEST_COUNT, etc.
- `AchievementRarity` - COMMON, RARE, EPIC, LEGENDARY
- `XpTransactionType` - DONATION_COMPLETED, ACHIEVEMENT_UNLOCKED, ADMIN_ADJUSTMENT, etc.
- `ReputationType` - VERIFIED_CONTRIBUTION, EMERGENCY_RESPONSE, etc.

## Configuration

All configurable values are in `apps/api/src/modules/gamification/config/gamification.config.ts`:
- XP values
- Level thresholds
- Level names
- Achievement definitions
- Badge definitions

## Testing

See `apps/api/src/modules/gamification/**/*.spec.ts` for unit tests covering:
- XP award logic
- Level calculation
- Achievement unlock conditions
- Anti-abuse checks
- Leaderboard ranking

## Phase 14+ Compatibility

The gamification system is designed to support future phases:
- Advanced notifications for achievements/level-ups
- Hospital analytics dashboards
- Courier transport tracking
- Admin management interfaces
