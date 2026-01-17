# GovTrack Data Schema Specification

## Overview

GovTrack uses JSONL (JSON Lines) format for persistent storage. Each line is a complete, valid JSON object representing a record. This format is:

- **Git-friendly**: Line-based diffs work well
- **Append-friendly**: New records append to end
- **Stream-friendly**: Can process large files line by line
- **Human-readable**: Easy to inspect and debug

## File Structure

```
.govtrack/
├── governments.jsonl    # Government entity records
├── issues.jsonl         # Issue records
├── config.json          # Configuration (standard JSON)
└── cache.db             # SQLite cache (binary, gitignored)
```

## Government Schema

**File**: `governments.jsonl`

### Record Structure

```typescript
interface Government {
  // Identity
  id: string;           // Format: "gt-<4-char-hash>", e.g., "gt-a1b2"
  slug: string;         // URL-friendly identifier, e.g., "city-of-austin"

  // Core fields
  name: string;         // Display name, e.g., "City of Austin"
  type: GovernmentType; // Enum: city, county, state, federal, district, other
  state?: string;       // 2-letter state code, e.g., "TX" (optional)

  // Status
  status: GovernmentStatus; // Enum: active, inactive

  // Timestamps (ISO 8601)
  created_at: string;   // When record was created
  updated_at: string;   // When record was last modified

  // Metadata (optional)
  metadata?: {
    website?: string;
    contact_email?: string;
    contact_phone?: string;
    address?: string;
    population?: number;
    [key: string]: unknown; // Extensible
  };
}

type GovernmentType = "city" | "county" | "state" | "federal" | "district" | "other";
type GovernmentStatus = "active" | "inactive";
```

### Example Records

```jsonl
{"id":"gt-a1b2","slug":"city-of-austin","name":"City of Austin","type":"city","state":"TX","status":"active","created_at":"2026-01-16T10:30:00.000Z","updated_at":"2026-01-16T10:30:00.000Z"}
{"id":"gt-c3d4","slug":"travis-county","name":"Travis County","type":"county","state":"TX","status":"active","created_at":"2026-01-16T10:35:00.000Z","updated_at":"2026-01-16T10:35:00.000Z"}
{"id":"gt-e5f6","slug":"austin-isd","name":"Austin Independent School District","type":"district","state":"TX","status":"active","created_at":"2026-01-16T10:40:00.000Z","updated_at":"2026-01-16T10:40:00.000Z","metadata":{"website":"https://austinisd.org"}}
```

### Validation Rules

| Field | Rule |
|-------|------|
| id | Required, unique, format `gt-[a-f0-9]{4}` |
| slug | Required, unique, lowercase, hyphens only, 1-100 chars |
| name | Required, 1-200 characters |
| type | Required, must be valid enum value |
| state | Optional, 2 uppercase letters if provided |
| status | Required, must be valid enum value |
| created_at | Required, valid ISO 8601 datetime |
| updated_at | Required, valid ISO 8601 datetime, >= created_at |

---

## Issue Schema

**File**: `issues.jsonl`

### Record Structure

```typescript
interface Issue {
  // Identity
  id: string;           // Format: "gi-<4-char-hash>", e.g., "gi-x1y2"

  // Relationship
  gov_id: string | null; // Government ID or null for unfiled

  // Core fields
  title: string;        // Brief description
  body?: string;        // Detailed description (optional)
  type: IssueType;      // Enum: report, request, complaint, other

  // Classification
  priority: Priority;   // 0-4 (0=critical, 4=backlog)
  status: IssueStatus;  // Enum: open, in_progress, resolved, closed, wont_fix

  // Location (optional)
  location?: {
    address?: string;
    lat?: number;
    lng?: number;
  };

  // Timestamps (ISO 8601)
  created_at: string;
  updated_at: string;
  closed_at?: string;   // When issue was closed (if applicable)

  // Metadata (optional)
  metadata?: {
    reporter_name?: string;
    reporter_email?: string;
    tags?: string[];
    close_reason?: string;
    [key: string]: unknown;
  };

  // History tracking
  history?: HistoryEntry[];
}

type IssueType = "report" | "request" | "complaint" | "other";
type IssueStatus = "open" | "in_progress" | "resolved" | "closed" | "wont_fix";
type Priority = 0 | 1 | 2 | 3 | 4;

interface HistoryEntry {
  timestamp: string;    // ISO 8601
  action: string;       // e.g., "created", "status_changed", "assigned"
  field?: string;       // Field that changed
  old_value?: unknown;  // Previous value
  new_value?: unknown;  // New value
  actor?: string;       // Who made the change
}
```

### Example Records

```jsonl
{"id":"gi-x1y2","gov_id":"gt-a1b2","title":"Pothole on Main St","body":"Large pothole near Oak St intersection","type":"report","priority":1,"status":"open","location":{"address":"123 Main St"},"created_at":"2026-01-16T11:00:00.000Z","updated_at":"2026-01-16T11:00:00.000Z","history":[{"timestamp":"2026-01-16T11:00:00.000Z","action":"created"}]}
{"id":"gi-z3w4","gov_id":"gt-a1b2","title":"Broken streetlight","type":"report","priority":2,"status":"in_progress","location":{"address":"456 Oak Ave"},"created_at":"2026-01-16T11:05:00.000Z","updated_at":"2026-01-16T12:30:00.000Z","history":[{"timestamp":"2026-01-16T11:05:00.000Z","action":"created"},{"timestamp":"2026-01-16T12:30:00.000Z","action":"status_changed","field":"status","old_value":"open","new_value":"in_progress"}]}
{"id":"gi-a5b6","gov_id":null,"title":"General complaint about services","type":"complaint","priority":2,"status":"open","created_at":"2026-01-16T11:10:00.000Z","updated_at":"2026-01-16T11:10:00.000Z"}
```

### Validation Rules

| Field | Rule |
|-------|------|
| id | Required, unique, format `gi-[a-f0-9]{4}` |
| gov_id | Nullable, if set must reference existing government |
| title | Required, 1-500 characters |
| body | Optional, max 10000 characters |
| type | Required, must be valid enum value |
| priority | Required, integer 0-4 |
| status | Required, must be valid enum value |
| location.address | Optional, max 500 characters |
| location.lat | Optional, -90 to 90 |
| location.lng | Optional, -180 to 180 |
| created_at | Required, valid ISO 8601 datetime |
| updated_at | Required, valid ISO 8601 datetime, >= created_at |
| closed_at | Required if status is closed/resolved/wont_fix |

---

## Configuration Schema

**File**: `config.json`

```typescript
interface Config {
  version: string;      // Schema version, e.g., "1.0.0"

  // Storage options
  cache_enabled: boolean;  // Whether to use SQLite cache

  // Defaults
  default_priority: Priority;  // Default priority for new issues
  default_issue_type: IssueType;

  // Web server
  web_port: number;
  web_host: string;

  // Display
  date_format?: string;  // e.g., "YYYY-MM-DD"
  timezone?: string;     // e.g., "America/Chicago"
}
```

### Example

```json
{
  "version": "1.0.0",
  "cache_enabled": true,
  "default_priority": 2,
  "default_issue_type": "report",
  "web_port": 3000,
  "web_host": "localhost"
}
```

---

## ID Generation

### Algorithm

IDs use a 4-character hash suffix for collision resistance:

```javascript
function generateId(prefix, inputs) {
  // Combine inputs with timestamp and random salt
  const data = JSON.stringify({
    ...inputs,
    timestamp: Date.now(),
    salt: crypto.randomBytes(4).toString('hex')
  });

  // SHA-256 hash, take first 4 hex chars
  const hash = crypto.createHash('sha256')
    .update(data)
    .digest('hex')
    .substring(0, 4);

  return `${prefix}-${hash}`;
}

// Usage
const govId = generateId('gt', { name: 'City of Austin' });  // "gt-a1b2"
const issueId = generateId('gi', { title: 'Pothole' });       // "gi-x3y4"
```

### Collision Handling

With 4 hex characters (65,536 possibilities), collisions are rare but possible. On collision:

1. Regenerate with new salt (up to 3 attempts)
2. If still colliding, extend hash to 5 characters
3. Log warning for monitoring

---

## Slug Generation

### Algorithm

```javascript
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/^-|-$/g, '')         // Trim leading/trailing hyphens
    .substring(0, 100);            // Limit length
}

// Usage
generateSlug("City of Austin")         // "city-of-austin"
generateSlug("Austin ISD")             // "austin-isd"
generateSlug("  Travis County!!! ")    // "travis-county"
```

### Uniqueness

Slugs must be unique. On conflict, append counter:
- `city-of-austin`
- `city-of-austin-2`
- `city-of-austin-3`

---

## JSONL Operations

### Append (Create)

```javascript
function appendRecord(file, record) {
  const line = JSON.stringify(record) + '\n';
  fs.appendFileSync(file, line);
}
```

### Update (Rewrite)

Updates require rewriting the file (JSONL limitation):

```javascript
function updateRecord(file, id, updates) {
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  const updated = lines.map(line => {
    const record = JSON.parse(line);
    if (record.id === id) {
      return JSON.stringify({ ...record, ...updates, updated_at: new Date().toISOString() });
    }
    return line;
  });
  fs.writeFileSync(file, updated.join('\n') + '\n');
}
```

### Read All

```javascript
function readAll(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .filter(line => line)
    .map(line => JSON.parse(line));
}
```

---

## SQLite Cache Schema

**File**: `cache.db` (gitignored)

```sql
CREATE TABLE governments (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  state TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata TEXT  -- JSON blob
);

CREATE TABLE issues (
  id TEXT PRIMARY KEY,
  gov_id TEXT REFERENCES governments(id),
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL,
  priority INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  location TEXT,  -- JSON blob
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  metadata TEXT,  -- JSON blob
  history TEXT    -- JSON blob
);

CREATE INDEX idx_issues_gov_id ON issues(gov_id);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_priority ON issues(priority);

-- Full-text search
CREATE VIRTUAL TABLE issues_fts USING fts5(
  title,
  body,
  content='issues',
  content_rowid='rowid'
);
```

The cache is rebuilt from JSONL files on:
- First run after init
- Detected mismatch between cache and JSONL
- Explicit `govtrack rebuild-cache` command
