# GovTrack Web API Specification

## Overview

The GovTrack web interface provides a REST API for reading and managing issues. The API is designed for the accompanying web dashboard but can be used by other clients.

## Base URL

```
http://localhost:3000/api
```

## Response Format

All responses use JSON with a consistent structure:

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Issue not found: gi-xxxx"
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `SERVER_ERROR` | 500 | Internal server error |

---

## Government Endpoints

### List Governments

```
GET /api/governments
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| type | string | Filter by government type |
| state | string | Filter by state code |
| status | string | Filter by status (active/inactive) |

**Response:**
```json
{
  "success": true,
  "data": {
    "governments": [
      {
        "id": "gt-a1b2",
        "slug": "city-of-austin",
        "name": "City of Austin",
        "type": "city",
        "state": "TX",
        "status": "active",
        "created_at": "2026-01-16T10:30:00.000Z",
        "updated_at": "2026-01-16T10:30:00.000Z",
        "issue_count": {
          "total": 12,
          "open": 8,
          "in_progress": 3,
          "resolved": 1
        }
      }
    ],
    "total": 5
  }
}
```

---

### Get Government

```
GET /api/governments/:id
```

**Path Parameters:**
| Param | Description |
|-------|-------------|
| id | Government ID (gt-xxx) or slug |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "gt-a1b2",
    "slug": "city-of-austin",
    "name": "City of Austin",
    "type": "city",
    "state": "TX",
    "status": "active",
    "created_at": "2026-01-16T10:30:00.000Z",
    "updated_at": "2026-01-16T10:30:00.000Z",
    "metadata": {
      "website": "https://austintexas.gov"
    },
    "issue_count": {
      "total": 12,
      "open": 8,
      "in_progress": 3,
      "resolved": 1,
      "closed": 0,
      "wont_fix": 0
    }
  }
}
```

---

### Create Government

```
POST /api/governments
```

**Request Body:**
```json
{
  "name": "City of Austin",
  "type": "city",
  "state": "TX",
  "slug": "austin",
  "metadata": {
    "website": "https://austintexas.gov"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| name | Yes | Government name |
| type | Yes | Type: city, county, state, federal, district, other |
| state | No | 2-letter state code |
| slug | No | Custom slug (auto-generated if omitted) |
| metadata | No | Additional metadata object |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "gt-a1b2",
    "slug": "austin",
    "name": "City of Austin",
    ...
  }
}
```

---

### Update Government

```
PATCH /api/governments/:id
```

**Request Body:**
```json
{
  "name": "City of Austin, Texas",
  "status": "inactive"
}
```

All fields optional. Only provided fields are updated.

---

### Delete Government

```
DELETE /api/governments/:id
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| reassign | string | Government ID to reassign issues to |
| force | boolean | Skip confirmation (for non-empty governments) |

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": "gt-a1b2",
    "issues_reassigned": 12
  }
}
```

---

## Issue Endpoints

### List Issues

```
GET /api/issues
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| gov_id | string | Filter by government ID or slug |
| unfiled | boolean | Show only unfiled issues (gov_id=null) |
| status | string | Filter by status |
| priority | number | Filter by priority (0-4) |
| type | string | Filter by type |
| search | string | Full-text search in title/body |
| sort | string | Sort field: created_at, updated_at, priority (default: created_at) |
| order | string | Sort order: asc, desc (default: desc) |
| limit | number | Results per page (default: 50, max: 200) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": {
    "issues": [
      {
        "id": "gi-x1y2",
        "gov_id": "gt-a1b2",
        "government": {
          "id": "gt-a1b2",
          "slug": "city-of-austin",
          "name": "City of Austin"
        },
        "title": "Pothole on Main St",
        "body": "Large pothole near Oak St intersection",
        "type": "report",
        "priority": 1,
        "status": "open",
        "location": {
          "address": "123 Main St"
        },
        "created_at": "2026-01-16T11:00:00.000Z",
        "updated_at": "2026-01-16T11:00:00.000Z"
      }
    ],
    "total": 47,
    "limit": 50,
    "offset": 0
  }
}
```

---

### Get Issue

```
GET /api/issues/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "gi-x1y2",
    "gov_id": "gt-a1b2",
    "government": {
      "id": "gt-a1b2",
      "slug": "city-of-austin",
      "name": "City of Austin"
    },
    "title": "Pothole on Main St",
    "body": "Large pothole near Oak St intersection",
    "type": "report",
    "priority": 1,
    "status": "open",
    "location": {
      "address": "123 Main St",
      "lat": 30.2672,
      "lng": -97.7431
    },
    "created_at": "2026-01-16T11:00:00.000Z",
    "updated_at": "2026-01-16T11:00:00.000Z",
    "metadata": {},
    "history": [
      {
        "timestamp": "2026-01-16T11:00:00.000Z",
        "action": "created"
      }
    ]
  }
}
```

---

### Create Issue

```
POST /api/issues
```

**Request Body:**
```json
{
  "title": "Pothole on Main St",
  "body": "Large pothole near Oak St intersection",
  "gov_id": "gt-a1b2",
  "type": "report",
  "priority": 1,
  "location": {
    "address": "123 Main St"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| title | Yes | Issue title (1-500 chars) |
| body | No | Detailed description |
| gov_id | No | Government ID (null for unfiled) |
| type | No | Type (default: report) |
| priority | No | Priority 0-4 (default: 2) |
| location | No | Location object |
| metadata | No | Additional metadata |

---

### Update Issue

```
PATCH /api/issues/:id
```

**Request Body:**
```json
{
  "status": "in_progress",
  "priority": 0
}
```

All fields optional.

---

### Close Issue

```
POST /api/issues/:id/close
```

**Request Body:**
```json
{
  "reason": "Repaired on 2026-01-15",
  "status": "resolved"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| reason | No | Closing reason |
| status | No | Final status: resolved, closed, wont_fix (default: resolved) |

---

### Reopen Issue

```
POST /api/issues/:id/reopen
```

Sets status back to "open".

---

### Assign Issue

```
POST /api/issues/:id/assign
```

**Request Body:**
```json
{
  "gov_id": "gt-a1b2"
}
```

Use `gov_id: null` to unfile the issue.

---

### Delete Issue

```
DELETE /api/issues/:id
```

---

## Statistics Endpoints

### Global Stats

```
GET /api/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "governments": {
      "total": 5,
      "active": 4,
      "inactive": 1
    },
    "issues": {
      "total": 47,
      "open": 23,
      "in_progress": 12,
      "resolved": 8,
      "closed": 3,
      "wont_fix": 1,
      "unfiled": 3
    },
    "by_priority": {
      "0": 2,
      "1": 8,
      "2": 25,
      "3": 10,
      "4": 2
    },
    "recent_activity": [
      {
        "issue_id": "gi-x1y2",
        "action": "created",
        "timestamp": "2026-01-16T11:00:00.000Z"
      }
    ]
  }
}
```

---

### Government Stats

```
GET /api/governments/:id/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "government": {
      "id": "gt-a1b2",
      "name": "City of Austin"
    },
    "issues": {
      "total": 12,
      "open": 8,
      "in_progress": 3,
      "resolved": 1
    },
    "by_priority": {
      "0": 0,
      "1": 3,
      "2": 7,
      "3": 2,
      "4": 0
    },
    "by_type": {
      "report": 8,
      "request": 3,
      "complaint": 1
    }
  }
}
```

---

## Web Pages (HTML)

The server also serves HTML pages for the dashboard:

| Path | Description |
|------|-------------|
| `/` | Dashboard with government list and stats |
| `/gov/:slug` | Government detail page with issues |
| `/unfiled` | Unfiled issues page |
| `/issue/:id` | Issue detail page |

These pages use server-side rendering with embedded data and vanilla JavaScript for interactivity.

---

## Real-time Updates

The web interface supports real-time updates via Server-Sent Events (SSE):

```
GET /api/events
```

**Event Types:**
- `issue:created` - New issue created
- `issue:updated` - Issue modified
- `issue:closed` - Issue closed
- `government:created` - New government added
- `government:updated` - Government modified

**Event Format:**
```
event: issue:created
data: {"id":"gi-x1y2","title":"New pothole report",...}

event: issue:updated
data: {"id":"gi-x1y2","status":"in_progress",...}
```

The server watches the JSONL files for changes and broadcasts events to connected clients.

---

## Rate Limiting

No rate limiting in v1 (localhost-only tool). Future versions may add:
- 100 requests/minute for reads
- 20 requests/minute for writes

---

## CORS

CORS is enabled for localhost origins by default:
- `http://localhost:*`
- `http://127.0.0.1:*`

Can be configured in `config.json` for other origins.
