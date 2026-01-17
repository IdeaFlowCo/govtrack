# GovTrack Architecture Specification

## Overview

GovTrack is a CLI-first issue tracker designed for local governments. It allows citizens and administrators to report issues (potholes, broken streetlights, service requests) to specific government entities, or create "unfiled" issues that can be assigned later.

## Design Principles

1. **CLI-First**: All functionality accessible via command line
2. **Git-Friendly Storage**: JSONL format for easy version control and diffing
3. **Offline-Capable**: Works without network; sync is optional
4. **Simple Web View**: Read-heavy web interface for browsing/filtering
5. **Hierarchical Organization**: Issues belong to governments (or remain unfiled)

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        User Layer                           │
├──────────────────────┬──────────────────────────────────────┤
│     CLI (govtrack)   │         Web Interface                │
│  - Commands          │  - Express.js server                 │
│  - Interactive mode  │  - REST API                          │
│  - Output formatting │  - HTML dashboard                    │
└──────────┬───────────┴──────────────┬───────────────────────┘
           │                          │
           ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Core Layer                             │
├─────────────────────────────────────────────────────────────┤
│  Government Module    │  Issue Module       │  Query Module │
│  - CRUD operations    │  - CRUD operations  │  - Filtering  │
│  - Validation         │  - Assignment       │  - Sorting    │
│  - Slug generation    │  - Status changes   │  - Search     │
└──────────┬────────────┴─────────┬───────────┴───────┬───────┘
           │                      │                   │
           ▼                      ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                            │
├─────────────────────────────────────────────────────────────┤
│  JSONL Files (.govtrack/)     │  SQLite Cache (optional)    │
│  - governments.jsonl          │  - Fast queries             │
│  - issues.jsonl               │  - Full-text search         │
│  - Append-only operations     │  - Rebuilt from JSONL       │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Creating an Issue (CLI)
```
User runs: govtrack issue "Pothole on Main St" --gov austin --priority 1

1. CLI parses command, validates args
2. Core resolves "austin" to government ID (gt-xxx)
3. Core generates issue ID (gi-xxx) using hash
4. Core appends issue record to issues.jsonl
5. Cache updated (if enabled)
6. CLI outputs confirmation with issue ID
```

### Viewing Issues (Web)
```
User visits: http://localhost:3000/gov/austin

1. Express receives request
2. API handler queries storage layer
3. Storage reads from cache (or JSONL if no cache)
4. Filters issues where gov_id matches austin
5. Returns JSON to API
6. Page renders issue list
```

## Directory Structure

```
project-root/
├── .govtrack/                    # Data directory
│   ├── governments.jsonl         # Government records
│   ├── issues.jsonl              # Issue records
│   ├── cache.db                  # SQLite cache (optional)
│   └── config.json               # Local configuration
├── specs/                        # Specification documents
└── ... (project files)
```

## ID Generation

Uses content-addressable hashing (similar to git/beads):

- **Government IDs**: `gt-<4-char-hash>` (e.g., `gt-a1b2`)
- **Issue IDs**: `gi-<4-char-hash>` (e.g., `gi-x3y4`)

Hash inputs:
- Government: name + type + state + created timestamp
- Issue: title + created timestamp + random salt

This prevents collisions and enables distributed creation.

## Status Model

### Government Status
- `active` - Accepting new issues
- `inactive` - Not accepting new issues (legacy/merged)

### Issue Status
- `open` - New issue, not being worked
- `in_progress` - Being addressed
- `resolved` - Fixed/completed
- `closed` - Closed (with or without resolution)
- `wont_fix` - Acknowledged but won't address

## Priority Levels

Following Beads convention (0 = highest):
- `P0` - Critical/emergency (water main break)
- `P1` - High priority (dangerous pothole)
- `P2` - Medium priority (default)
- `P3` - Low priority (cosmetic issues)
- `P4` - Backlog/someday

## Web Interface Pages

1. **Dashboard** (`/`)
   - List of all governments with issue counts
   - Recent activity feed
   - Quick stats

2. **Government View** (`/gov/:slug`)
   - Government details
   - Issue list with filtering
   - Status breakdown chart

3. **Unfiled Issues** (`/unfiled`)
   - Issues without government assignment
   - Bulk assignment interface

4. **Issue Detail** (`/issue/:id`)
   - Full issue information
   - Assignment controls
   - Status history

## Configuration

`.govtrack/config.json`:
```json
{
  "version": "1.0.0",
  "cache_enabled": true,
  "default_priority": 2,
  "web_port": 3000
}
```

## Error Handling

- All operations return structured results
- CLI uses exit codes (0 = success, 1 = error)
- Web API uses standard HTTP status codes
- Errors include machine-readable codes and human messages

## Security Considerations

- No authentication in v1 (local tool)
- File permissions follow OS defaults
- Web interface binds to localhost only by default
- Input sanitization for all user-provided data
