# Blood Transport & Courier Shipment System

## Overview

This document describes the real-time blood transport tracking system that connects Hospital ↔ Blood Center ↔ Courier with live GPS tracking, state machine validation, and WebSocket-based updates.

## Architecture

### Components

1. **ShipmentStateService** (`apps/api/src/modules/shipments/services/shipment-state.service.ts`)
   - Validates all shipment state transitions
   - Enforces business rules for each transition
   - Prevents invalid state jumps

2. **LocationService** (`apps/api/src/modules/shipments/services/location.service.ts`)
   - Validates GPS coordinates for sanity
   - Detects impossible jumps (>50km in 5 minutes)
   - Detects abnormal speed (>200 km/h)
   - Rejects stale locations (>24 hours old)
   - Calculates Haversine distances (fallback, displayed as "estimated")

3. **ShipmentGateway** (`apps/api/src/gateways/shipment.gateway.ts`)
   - WebSocket (Socket.IO) real-time communication
   - Authorized rooms based on organization membership
   - Events: `shipment:location`, `shipment:status`, `shipment:eta`

4. **CourierModule** (`apps/api/src/modules/courier/`)
   - Courier profile management
   - Status tracking (AVAILABLE, BUSY, OFFLINE)
   - Shipment assignment and acceptance workflow

## State Machine

```
CREATED → COURIER_ASSIGNED → COURIER_ACCEPTED → PICKUP_STARTED → PICKED_UP → IN_TRANSIT → ARRIVED_AT_HOSPITAL → DELIVERED
                                                    ↓                   ↓
                                                  FAILED ←────────────┘
                                                    ↓
                                         (reassignment possible)
```

### Valid Transitions

| From Status | Allowed Next States |
|-------------|---------------------|
| CREATED | COURIER_ASSIGNED, CANCELLED |
| COURIER_ASSIGNED | COURIER_ACCEPTED, COURIER_DECLINED, CANCELLED |
| COURIER_DECLINED | COURIER_ASSIGNED, CANCELLED |
| COURIER_ACCEPTED | PICKUP_STARTED, CANCELLED |
| PICKUP_STARTED | PICKED_UP, FAILED, CANCELLED |
| PICKED_UP | IN_TRANSIT, FAILED, CANCELLED |
| IN_TRANSIT | ARRIVED_AT_HOSPITAL, FAILED, CANCELLED |
| ARRIVED_AT_HOSPITAL | DELIVERED, FAILED, CANCELLED |
| DELIVERED | (terminal) |
| FAILED | COURIER_ASSIGNED, CANCELLED |

## API Endpoints

### Shipments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/shipments` | List shipments (filtered by org) |
| GET | `/shipments/:id` | Get shipment details |
| GET | `/shipments/:id/timeline` | Get event timeline |
| GET | `/shipments/:id/tracking` | Get tracking info with ETA |
| GET | `/shipments/:id/locations` | Get GPS history |
| POST | `/shipments` | Create shipment (blood center) |
| POST | `/shipments/:id/cancel` | Cancel shipment |
| POST | `/shipments/:id/reassign` | Reassign to different courier |
| POST | `/shipments/:id/confirm-delivery-full` | Hospital confirms delivery |

### Courier

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courier/profile` | Get courier profile |
| POST | `/courier/status` | Update courier status |
| GET | `/courier/shipments` | List courier shipments |
| GET | `/courier/shipments/active` | Get active shipment |
| POST | `/courier/shipments/:id/accept` | Accept shipment |
| POST | `/courier/shipments/:id/decline` | Decline shipment |
| POST | `/courier/shipments/:id/start-pickup` | Start pickup |
| POST | `/courier/shipments/:id/confirm-pickup` | Confirm pickup |
| POST | `/courier/shipments/:id/start-delivery` | Start delivery |
| POST | `/courier/shipments/:id/update-location` | Update GPS location |
| POST | `/courier/shipments/:id/arrive` | Arrive at hospital |
| POST | `/courier/shipments/:id/fail` | Mark delivery failed |

## WebSocket Events

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `shipment:location` | `{shipmentId, latitude, longitude, recordedAt}` | Real-time location update |
| `shipment:status` | `{shipmentId, status, timestamp}` | Status change |
| `shipment:eta` | `{shipmentId, etaMinutes, distanceKm, note}` | ETA update |

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe:shipment` | `{shipmentId}` | Subscribe to shipment updates |
| `unsubscribe:shipment` | `{shipmentId}` | Unsubscribe from updates |

## Security

- Organization isolation: Hospital A cannot access Hospital B's shipments
- Role-based access: Only couriers can update location
- State transitions validated server-side only
- GPS location never automatically confirms delivery
- Inventory only updates after authorized delivery confirmation

## Notifications

The system emits `shipment.event` events for the following:

| Event Type | Recipients |
|------------|------------|
| created | Blood center staff |
| courier_assigned | Assigned courier |
| accepted | Blood center staff |
| picked_up | Blood center staff |
| in_transit | Hospital staff |
| arrived | Hospital staff |
| delivered | Blood center staff, courier |
| failed | Blood center staff |

## Location Validation Rules

1. **Impossible Jump Detection**: Reject if >50km from last known position in <5 minutes
2. **Abnormal Speed Detection**: Reject if calculated speed >200 km/h
3. **Stale Location Detection**: Reject if location timestamp >24 hours old
4. **Coordinate Bounds**: Latitude must be -90 to 90, longitude must be -180 to 180

## ETA Calculation

- Uses straight-line (Haversine) distance as fallback
- Displayed with "estimated" label since real roads not used
- Requires destination coordinates to be available

## Frontend Pages

### Blood Center Web (`apps/blood-center-web`)
- `/shipments` - List all shipments with status filters
- `/shipments/[id]` - Shipment detail with courier assignment, tracking map, timeline

### Hospital Web (`apps/hospital-web`)
- `/shipments` - List incoming shipments
- `/shipments/[id]` - Shipment tracking with live location, delivery confirmation modal

### Mobile API (`apps/mobile/src/api/courier.ts`)
- Full courier client API for future courier app implementation
