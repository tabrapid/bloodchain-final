# API

The BloodChain API is a REST API built with NestJS. All endpoints are prefixed with `/api/v1`.

## Documentation

Interactive Swagger docs are available at `http://localhost:3001/docs` when the API is running.

## Authentication

Most endpoints require a Bearer token:

```
Authorization: Bearer <accessToken>
```

### Endpoints

| Method | Endpoint                           | Description                              | Auth                |
| ------ | ---------------------------------- | ---------------------------------------- | ------------------- |
| POST   | `/api/v1/auth/register`            | Register a donor account                 | Public              |
| POST   | `/api/v1/auth/login`               | Login and receive tokens                 | Public              |
| POST   | `/api/v1/auth/refresh`             | Rotate access token                      | Public              |
| POST   | `/api/v1/auth/logout`              | Revoke refresh token                     | Public              |
| GET    | `/api/v1/auth/me`                  | Current user                             | Bearer              |
| GET    | `/api/v1/users`                    | List users (admin)                       | Bearer + admin role |
| GET    | `/api/v1/users/:id`                | Get a user                               | Bearer              |
| GET    | `/api/v1/organizations`            | List organizations (admin)               | Bearer + admin role |
| GET    | `/api/v1/organizations/:id`        | Get an organization                      | Bearer              |
| GET    | `/api/v1/donors/profile`           | Donor profile placeholder                 | Bearer + DONOR      |
| GET    | `/api/v1/health`                   | Health check                             | Public              |
| GET    | `/api/v1/me/health-trends`         | Health trends summary                     | Bearer (DONOR)      |
| GET    | `/api/v1/me/health-trends/parameters` | Available trend parameters             | Bearer (DONOR)      |
| GET    | `/api/v1/me/health-trends/:parameter` | Trend data for specific parameter       | Bearer (DONOR)      |
| GET    | `/api/v1/me/health-trends/:parameter/statistics` | Statistics for parameter    | Bearer (DONOR)      |
| GET    | `/api/v1/me/health-trends/:parameter/history` | History for parameter        | Bearer (DONOR)      |
| POST   | `/api/v1/me/ai/insights`            | Generate AI health insight              | Bearer (DONOR)      |
| POST   | `/api/v1/me/ai/explain-result`      | Explain a specific result              | Bearer (DONOR)      |
| POST   | `/api/v1/me/ai/analyze-trend`       | Analyze a parameter trend              | Bearer (DONOR)      |
| POST   | `/api/v1/me/ai/chat`                | Chat with AI assistant                 | Bearer (DONOR)      |

## Request/response format

Success:

```json
{
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

Error:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "...",
  "details": {}
}
```

## Pagination

List endpoints accept `?page=1&limit=20`. `limit` is capped at 100.

## Error codes

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `REQUEST_FAILED`

## Real-time

Two Socket.IO gateways are implemented. Both require a JWT on connection and
scope every broadcast to a room, so a client only receives events for records it
is authorised to see.

`/emergency` — server emits `connected`, `error`, `timeout`, plus
`donor_location` and `response_status_changed` to the hospital room.

`/shipments` — server emits `connected`, `error`, `timeout`, `shipment_state`,
and broadcasts `courier_location`, `shipment_status_changed`,
`shipment_updated`, `eta_updated` and `delivery_confirmed` to the shipment room.

Separately, the backend emits in-process domain events via
`@nestjs/event-emitter`, consumed by 21 handlers (gamification is the main
consumer): `donation.completed`, `blood-test.completed`,
`appointment.completed`, `emergency-response.completed` and
`challenge.completed`. These are in-process only — they are not published to an
external broker.
