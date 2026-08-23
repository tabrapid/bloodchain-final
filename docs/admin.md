# Admin & Platform Management System

## Overview

Phase 17 implements a comprehensive Super Admin and Platform Management system for the DONOR ecosystem, providing complete oversight and control over all platform operations.

## Architecture

```
                    SUPER ADMIN
                         |
        +----------------+----------------+
        |                |                |
      USERS        ORGANIZATIONS       OPERATIONS
        |                |                |
     Donors       Hospitals          Blood Centers
     Staff        Couriers           Requests
     Couriers                        Inventory
                                      Shipments
                                      SOS
                                      Analytics
```

## Admin Roles

The system uses existing role-based access control with the `SUPER_ADMIN` role having full platform access:

- **SUPER_ADMIN**: Full platform administration access
- **PLATFORM_ADMIN**: (Uses existing roles with organization scope)

## Permission System

Admin endpoints are protected by:
1. JWT Authentication
2. Role Guard (`@Roles(RoleCode.SUPER_ADMIN)`)
3. Permission Guard (`@Permissions('admin.manage')`)

All admin routes require `admin.manage` permission which is automatically granted to `SUPER_ADMIN` users.

## Admin API Endpoints

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | Platform overview stats |
| GET | `/admin/activity` | Recent activity feed |
| GET | `/admin/health` | System health status |

### User Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List all users |
| GET | `/admin/users/:id` | Get user details |
| POST | `/admin/users/:id/suspend` | Suspend user |
| POST | `/admin/users/:id/restore` | Restore user |

### Organization Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/organizations` | List all organizations |
| GET | `/admin/organizations/:id` | Get organization details |
| POST | `/admin/organizations/:id/verify` | Verify organization |
| POST | `/admin/organizations/:id/reject` | Reject organization |
| POST | `/admin/organizations/:id/suspend` | Suspend organization |
| POST | `/admin/organizations/:id/restore` | Restore organization |

### Courier Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/couriers` | List all couriers |
| GET | `/admin/couriers/:id` | Get courier details |
| POST | `/admin/couriers/:id/suspend` | Suspend courier |
| POST | `/admin/couriers/:id/restore` | Restore courier |

### Operations Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/shipments` | List all shipments |
| GET | `/admin/shipments/:id` | Get shipment details |
| GET | `/admin/blood-requests` | List all blood requests |
| GET | `/admin/emergencies` | List all SOS emergencies |
| GET | `/admin/inventory/overview` | Platform inventory summary |
| GET | `/admin/alerts` | List platform alerts |
| POST | `/admin/alerts/:id/acknowledge` | Acknowledge alert |

### Audit & Compliance
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/audit-logs` | List audit logs |
| GET | `/admin/search` | Global search |

## Key Files

### Backend
- `apps/api/src/modules/admin/admin.module.ts` - Admin module
- `apps/api/src/modules/admin/admin.controller.ts` - Admin API controller
- `apps/api/src/modules/admin/admin.service.ts` - Admin business logic
- `apps/api/src/modules/admin/dto/admin.dto.ts` - Admin DTOs

### Frontend (Admin Web Application)
- `apps/admin-web/` - Next.js admin application
- `apps/admin-web/lib/api.ts` - Admin API client
- `apps/admin-web/lib/auth.ts` - Admin authentication
- `apps/admin-web/app/page.tsx` - Dashboard
- `apps/admin-web/app/users/page.tsx` - User management
- `apps/admin-web/app/organizations/page.tsx` - Organization management
- `apps/admin-web/app/couriers/page.tsx` - Courier management
- `apps/admin-web/app/shipments/page.tsx` - Shipment monitoring
- `apps/admin-web/app/requests/page.tsx` - Blood request monitoring
- `apps/admin-web/app/emergencies/page.tsx` - SOS monitoring
- `apps/admin-web/app/inventory/page.tsx` - Inventory overview
- `apps/admin-web/app/alerts/page.tsx` - Alert management
- `apps/admin-web/app/audit/page.tsx` - Audit logs
- `apps/admin-web/app/health/page.tsx` - System health
- `apps/admin-web/app/settings/page.tsx` - Platform settings

## Security Features

1. **Authentication**: JWT-based with refresh token rotation
2. **Authorization**: Role-based (SUPER_ADMIN required)
3. **Audit Logging**: All sensitive actions are logged
4. **Organization Isolation**: Admin actions are scoped to platform level
5. **Self-Protection**: Admins cannot suspend themselves

## Privacy Protection

- Health data (blood tests, health metrics) is NOT exposed in admin views
- Donor private information is restricted
- Location data for donors/couriers requires explicit permission
- Minimum necessary access principle applied

## Dashboard Metrics

The admin dashboard displays:
- Total Users / Active Users / Verified Donors
- Hospitals / Blood Centers (with pending/suspended counts)
- Couriers
- Active Shipments
- Active Emergencies
- Blood Requests (active/critical)
- Today's Activity (donations, appointments, blood tests)
- System Health
- Pending Organizations
- Active Alerts

## Audit Log Actions

The system tracks:
- USER_SUSPENDED / USER_RESTORED
- ORGANIZATION_VERIFIED / ORGANIZATION_REJECTED / ORGANIZATION_SUSPENDED / ORGANIZATION_RESTORED
- COURIER_SUSPENDED / COURIER_RESTORED
- ALERT_ACKNOWLEDGED
- All administrative changes are immutable

## Existing Systems Reused

- Authentication system (no duplicate auth)
- Permission system (extends existing RBAC)
- Audit log model (existing schema)
- Notification system (Phase 14)
- Analytics system (Phase 15)
- Shipment tracking (Phase 16)

## Limitations & Future Work

1. **Support Tickets**: Basic structure exists in DTOs but UI not fully implemented
2. **Feature Flags**: Settings page shows static values; actual toggle functionality requires additional backend
3. **MFA**: Architecture supports it but not enforced for admins
4. **Bulk Actions**: Not implemented in initial release
5. **Admin Invitations**: Not implemented in initial release
