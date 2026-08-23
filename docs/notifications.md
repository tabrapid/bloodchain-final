# Notifications System

This document describes the notification and communication system implemented in Phase 14.

## Overview

The DONOR platform includes a centralized, production-quality notification system that unifies:
- Emergency SOS notifications
- Blood donation notifications
- Appointment reminders
- Laboratory result notifications
- AI insight notifications
- Gamification notifications (achievements, level-ups)
- Blood request notifications
- Shipment updates
- Inventory alerts
- Security notifications

## Architecture

### Module Structure

```
apps/api/src/modules/notifications/
├── notifications.module.ts
├── notifications.controller.ts
├── dto/
│   ├── notification.enums.ts
│   ├── create-notification.dto.ts
│   ├── push-device.dto.ts
│   └── notification-preference.dto.ts
├── services/
│   ├── notifications.service.ts       # Core notification CRUD
│   ├── push-device.service.ts        # Device token management
│   ├── notification-preference.service.ts  # User preferences
│   ├── notification-delivery.service.ts   # Push delivery pipeline
│   └── notification-router.service.ts      # Event-to-notification routing
└── handlers/
    └── notification-event.handler.ts  # Domain event listeners
```

## Notification Types

| Type | Description | Priority Support |
|------|-------------|------------------|
| EMERGENCY | SOS/blood emergency requests | CRITICAL, HIGH, NORMAL, LOW |
| DONATION | Donation confirmations | NORMAL, LOW |
| APPOINTMENT | Appointment bookings/reminders | HIGH, NORMAL |
| LABORATORY | Blood test results | NORMAL, LOW |
| AI | AI health insights ready | LOW |
| GAMIFICATION | Achievements, level-ups | LOW |
| BLOOD_REQUEST | Blood request updates | HIGH, NORMAL |
| SHIPMENT | Courier shipment updates | HIGH, NORMAL |
| INVENTORY | Inventory alerts | HIGH, NORMAL |
| SECURITY | Security alerts | HIGH |
| SYSTEM | System notifications | NORMAL, LOW |

## Priority Levels

- **CRITICAL**: Emergency SOS, immediate action required
- **HIGH**: Important operational alerts
- **NORMAL**: Standard notifications
- **LOW**: Low-priority updates, achievements

## Database Models

### PushDevice
Stores device tokens for push notifications:
- `token`: Unique Expo push token
- `platform`: ios/android
- `locale`: User's language preference
- `timezone`: User's timezone
- `isActive`: Token validity status

### Notification
Core notification record:
- `recipientId`: Target user
- `type`: NotificationType enum
- `priority`: NotificationPriority enum
- `title`/`body`: Content (localized)
- `data`: JSON metadata
- `deepLink`: Navigation target
- `status`: PENDING → SENT → DELIVERED → READ/ARCHIVED/EXPIRED
- `idempotencyKey`: Prevents duplicate notifications

### NotificationDelivery
Tracks delivery status per channel:
- `channel`: PUSH/IN_APP/EMAIL/SMS
- `status`: DeliveryStatus enum
- `attempts`: Retry count
- `lastAttemptAt`: Last delivery attempt
- `errorCode`/`errorMessage`: Failure details

### NotificationPreference (Extended)
User notification settings:
- `emergencyRequests`: Emergency SOS alerts
- `appointments`: Appointment notifications
- `donationReminders`: Donation reminders
- `healthResults`: Lab results
- `gamification`: Achievements/levels
- `bloodRequests`: Blood request updates
- `shipments`: Shipment tracking
- `inventory`: Inventory alerts (staff)
- `system`: System notifications
- `security`: Security alerts
- `quietHoursEnabled`: Quiet hours toggle
- `quietHoursStart`/`quietHoursEnd`: Time range
- `quietHoursTimezone`: User timezone
- `emergencyOverride`: Allow critical override quiet hours

## Event-Driven Design

Notifications are triggered by domain events:

### Events Listened

| Event | Source | Notification |
|-------|--------|--------------|
| `donation.completed` | DonationsService | DONATION confirmation |
| `blood-test.completed` | LaboratoryService | LAB result available |
| `sos.request.created` | EmergencyService | EMERGENCY to compatible donors |
| `sos.donor.accepted` | EmergencyService | EMERGENCY response to hospital |
| `sos.request.expired` | EmergencyService | Mark notifications expired |
| `appointment.created` | AppointmentsService | APPOINTMENT booking |
| `appointment.reminder` | AppointmentsService | APPOINTMENT reminder |
| `appointment.cancelled` | AppointmentsService | APPOINTMENT cancellation |
| `lab-result.published` | LaboratoryService | LAB result ready |
| `achievement.unlocked` | GamificationService | GAMIFICATION achievement |
| `level.up` | GamificationService | GAMIFICATION level up |
| `shipment.event` | ShipmentsService | SHIPMENT status update |
| `inventory.alert` | InventoryService | INVENTORY alert |
| `security.event` | AuthService | SECURITY alert |

## Delivery Pipeline

```
Domain Event
    ↓
Notification Router
    ↓
Preference Check (category enabled?)
    ↓
Quiet Hours Check (normal only)
    ↓
Template Selection
    ↓
Deduplication Check (idempotencyKey)
    ↓
Persistence (create Notification record)
    ↓
Push Delivery
    ↓
Delivery Result (success/failure)
    ↓
Status Update
```

## Security & Privacy

### SOS Notifications
- Donor receives: blood type, urgency, hospital general area, expiration
- Donor does NOT receive: patient name, diagnosis, exact location, private medical info

### Push Notifications
- No sensitive medical values in push body
- Lab values only accessible via authenticated API after push
- Deep links verify authorization before showing data

### Role-Based Routing
| Role | Receives |
|------|----------|
| DONOR | Donation, Appointment, Lab, AI, Gamification, personal SOS |
| HOSPITAL_STAFF | SOS responses, Donation confirmations, Inventory alerts |
| BLOOD_CENTER_STAFF | Blood requests, Shipments, Inventory |
| COURIER | Shipment assignments, Pickup/delivery updates |
| ADMIN | System alerts, Security events |

## Mobile Implementation

### API Client (`apps/mobile/src/api/notifications.ts`)
- `getNotifications(filter)` - Paginated notification list
- `getNotificationStats()` - Unread counts
- `markAsRead/markAsUnread()` - Read state management
- `getNotificationPreferences()` - User settings
- `updateNotificationPreferences()` - Update settings
- `registerPushDevice()` - Token registration

### Hooks (`apps/mobile/src/hooks/useNotifications.ts`)
- `useNotifications(filter)` - Notification list with React Query
- `useNotificationStats()` - Stats for badge display
- `useUnreadCount()` - Real-time unread count
- `useMarkNotificationAsRead()` - Mutation for marking read
- `useNotificationPreferences()` - Preferences query
- `useUpdateNotificationPreferences()` - Preferences mutation

### Notification Center Screen (`apps/mobile/app/(app)/notifications.tsx`)
- Tabbed view: All / Unread
- Notification cards with type indicator, priority badge
- Time ago formatting
- Deep link navigation
- Pull-to-refresh
- Mark all read action

## Deep Links

| Notification Type | Deep Link |
|-------------------|-----------|
| SOS | `/sos/:id` |
| Donation | `/donations/:id` |
| Appointment | `/calendar/appointment/:id` |
| Lab Result | `/health/tests/:id` |
| AI Insight | `/health/insights/:id` |
| Achievement | `/profile/achievements/:id` |
| Shipment | `/shipments/:id` |

## Deduplication

Notifications use idempotency keys to prevent duplicates:
- `idempotencyKey = sourceType:sourceId:recipientId`
- Same event cannot create duplicate notifications
- SOS notifications use `SOS:requestId` as key prefix

## Quiet Hours

Users can configure:
- Enabled/disabled toggle
- Start time (e.g., 22:00)
- End time (e.g., 07:00)
- Timezone (defaults to UTC)

**Override Policy**: Critical emergency notifications may override quiet hours if `emergencyOverride: true`.

## Delivery Reliability

- **Retry**: Transient failures retry with exponential backoff
- **Invalid Tokens**: Automatically deactivated after 3 failed attempts
- **Offline**: Notifications persist in-app; push fails gracefully
- **Fallback**: In-app notification always visible even if push fails

## Analytics

Tracked metrics:
- `notification.created` - Notification created
- `notification.sent` - Sent to push provider
- `notification.delivered` - Confirmed by provider
- `notification.failed` - Delivery failure
- `notification.opened` - User tapped notification
- `notification.acted` - User completed action

Calculated:
- Open rate: opened / delivered
- Action rate: acted / opened
- Emergency response rate: accepted / delivered

## Future Phase Compatibility

Phase 14 prepares clean interfaces for:
- **Phase 15**: Hospital/Blood Center Analytics
- **Phase 16**: Courier & Blood Transport Tracking
- **Phase 17**: Admin/Platform Management
- **Phase 18**: Advanced Donor Community

## Files Created/Modified

### New Files
- `apps/api/src/modules/notifications/` - Complete module
- `apps/api/prisma/schema.prisma` - New models and enums
- `apps/mobile/src/api/notifications.ts` - Extended API client
- `apps/mobile/src/hooks/useNotifications.ts` - Extended hooks
- `apps/mobile/app/(app)/notifications.tsx` - Notification center

### Modified Files
- `apps/api/src/app.module.ts` - Added NotificationsModule
- `apps/api/src/modules/notification-preferences/` - Extended preferences
- `apps/api/src/modules/users/users.service.ts` - Updated preferences response
- `docs/notifications.md` - This documentation

## Configuration

XP values, achievement definitions, and level thresholds are configured in:
`apps/api/src/modules/gamification/config/gamification.config.ts`

Notification delivery settings (retry limits, batch sizes) can be configured via environment variables when needed.
