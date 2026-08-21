# API

The DONOR API is a REST API built with NestJS. All endpoints are prefixed with `/api/v1`.

## Documentation

Interactive Swagger docs are available at `http://localhost:3001/docs` when the API is running.

## Authentication

Most endpoints require a Bearer token:

```
Authorization: Bearer <accessToken>
```

### Endpoints

| Method | Endpoint                    | Description                | Auth                |
| ------ | --------------------------- | -------------------------- | ------------------- |
| POST   | `/api/v1/auth/register`     | Register a donor account   | Public              |
| POST   | `/api/v1/auth/login`        | Login and receive tokens   | Public              |
| POST   | `/api/v1/auth/refresh`      | Rotate access token        | Public              |
| POST   | `/api/v1/auth/logout`       | Revoke refresh token       | Public              |
| GET    | `/api/v1/auth/me`           | Current user               | Bearer              |
| GET    | `/api/v1/users`             | List users (admin)         | Bearer + admin role |
| GET    | `/api/v1/users/:id`         | Get a user                 | Bearer              |
| GET    | `/api/v1/organizations`     | List organizations (admin) | Bearer + admin role |
| GET    | `/api/v1/organizations/:id` | Get an organization        | Bearer              |
| GET    | `/api/v1/donors/profile`    | Donor profile placeholder  | Bearer + DONOR      |
| GET    | `/api/v1/health`            | Health check               | Public              |

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

## Real-time preparation

WebSocket gateways and domain events are not implemented in Phase 1. Planned event names include `SOS_CREATED`, `DONOR_LOCATION_UPDATED`, `DONATION_COMPLETED`, `SHIPMENT_UPDATED`, and `INVENTORY_UPDATED`.
